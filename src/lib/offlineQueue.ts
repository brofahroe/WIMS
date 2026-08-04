/**
 * Offline Queue — menyimpan operasi yang gagal karena offline ke localStorage,
 * lalu menjalankannya ulang saat koneksi tersedia kembali.
 *
 * Setiap operasi disimpan sebagai item antrian dengan tipe:
 *   - INSERT  : insert satu atau lebih baris transaksi baru
 *   - UPDATE  : update field tertentu pada satu transaksi
 *   - DELETE  : soft-delete (set deleted_at) pada satu transaksi
 */

import type { TransactionRecord } from "../types";

export type QueueItemType = "INSERT" | "UPDATE" | "DELETE";

export interface QueueItem {
  id: string;          // ID unik antrian (bukan ID transaksi)
  type: QueueItemType;
  table: string;
  recordId: string;    // ID transaksi yang dioperasikan
  payload: unknown;    // data yang akan dikirim ke Supabase
  createdAt: string;
  retryCount: number;
}

const QUEUE_KEY = "wims-offline-queue";
const MAX_RETRY = 5;

// ─── Baca / tulis queue ──────────────────────────────────────────────────────

export function getQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueueItem[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    console.warn("offlineQueue: localStorage penuh, tidak bisa menyimpan queue.");
  }
}

// ─── Tambah item ke queue ────────────────────────────────────────────────────

export function enqueue(
  type: QueueItemType,
  table: string,
  recordId: string,
  payload: unknown,
): void {
  const item: QueueItem = {
    id: crypto.randomUUID(),
    type,
    table,
    recordId,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  const queue = getQueue();
  queue.push(item);
  saveQueue(queue);
}

export function enqueueInsert(table: string, rows: TransactionRecord[]): void {
  // Simpan sebagai satu item per baris agar retry bisa granular
  const queue = getQueue();
  for (const row of rows) {
    queue.push({
      id: crypto.randomUUID(),
      type: "INSERT",
      table,
      recordId: row.id,
      payload: row,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  }
  saveQueue(queue);
}

export function enqueueUpdate(
  table: string,
  recordId: string,
  updates: Record<string, unknown>,
): void {
  // Jika sudah ada UPDATE pending untuk recordId yang sama, merge saja
  const queue = getQueue();
  const existing = queue.find(
    (q) => q.type === "UPDATE" && q.table === table && q.recordId === recordId,
  );
  if (existing) {
    existing.payload = { ...(existing.payload as object), ...updates };
    saveQueue(queue);
  } else {
    enqueue("UPDATE", table, recordId, updates);
  }
}

export function enqueueDelete(table: string, recordId: string): void {
  // Hapus semua UPDATE pending untuk record yang sama (tidak relevan lagi)
  const queue = getQueue().filter(
    (q) => !(q.table === table && q.recordId === recordId && q.type === "UPDATE"),
  );
  saveQueue(queue);
  enqueue("DELETE", table, recordId, { deleted_at: new Date().toISOString() });
}

// ─── Hapus item dari queue ───────────────────────────────────────────────────

export function dequeue(itemId: string): void {
  saveQueue(getQueue().filter((q) => q.id !== itemId));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

// ─── Flush: kirim semua item ke Supabase ────────────────────────────────────

/**
 * Jalankan semua item di queue. Dipanggil saat koneksi kembali online.
 * Mengembalikan jumlah item yang berhasil disync.
 */
export async function flushQueue(
  supabaseClient: import("@supabase/supabase-js").SupabaseClient,
): Promise<{ synced: number; failed: number }> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      let error: import("@supabase/supabase-js").PostgrestError | null = null;

      if (item.type === "INSERT") {
        const result = await supabaseClient.from(item.table).upsert(item.payload as object);
        error = result.error;
      } else if (item.type === "UPDATE") {
        const result = await supabaseClient
          .from(item.table)
          .update(item.payload as object)
          .eq("id", item.recordId);
        error = result.error;
      } else if (item.type === "DELETE") {
        const result = await supabaseClient
          .from(item.table)
          .update({ deleted_at: (item.payload as any).deleted_at })
          .eq("id", item.recordId);
        error = result.error;
      }

      if (error) throw error;

      dequeue(item.id);
      synced++;
    } catch (err) {
      console.warn(`offlineQueue: gagal sync item ${item.id} (retry ${item.retryCount + 1})`, err);
      // Naikkan retry counter; hapus jika sudah melebihi batas
      const queue2 = getQueue();
      const idx = queue2.findIndex((q) => q.id === item.id);
      if (idx !== -1) {
        queue2[idx].retryCount += 1;
        if (queue2[idx].retryCount >= MAX_RETRY) {
          console.error(`offlineQueue: item ${item.id} dihapus setelah ${MAX_RETRY}x gagal.`);
          queue2.splice(idx, 1);
        }
        saveQueue(queue2);
      }
      failed++;
    }
  }

  return { synced, failed };
}
