import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

// ─── Cache layer untuk mode hybrid offline ───────────────────────────────────
// Setiap tabel yang di-fetch disimpan di localStorage dengan key "wims-cache-<table>".
// Saat offline (fetch gagal), data dikembalikan dari cache.
// Cache diperbarui setiap kali fetch berhasil.

const CACHE_PREFIX = "wims-cache-";

function getCached<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${table}`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function setCache<T>(table: string, data: T[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${table}`, JSON.stringify(data));
    localStorage.setItem(`${CACHE_PREFIX}${table}__ts`, new Date().toISOString());
  } catch {
    console.warn(`fetchAll: tidak bisa cache tabel "${table}" — localStorage penuh.`);
  }
}

export function getCacheTimestamp(table: string): string | null {
  return localStorage.getItem(`${CACHE_PREFIX}${table}__ts`);
}

export function clearTableCache(table: string): void {
  localStorage.removeItem(`${CACHE_PREFIX}${table}`);
  localStorage.removeItem(`${CACHE_PREFIX}${table}__ts`);
}

// ─── fetchAll dengan fallback ke cache ───────────────────────────────────────

// Bug #6 fix: add a maximum-page safeguard so fetchAll never loops infinitely
// or exhausts memory on unexpectedly large tables. 200 pages × 1 000 rows = 200 k rows max.
const FETCH_MAX_PAGES = 200;

/**
 * Fetch semua baris dari tabel Supabase dengan pagination.
 * - Saat online  : ambil dari Supabase, simpan ke cache, kembalikan data segar.
 * - Saat offline : kembalikan data dari cache localStorage.
 * @param forceCache paksa pakai cache meskipun online (untuk performa)
 */
export async function fetchAll(table: string, forceCache = false): Promise<any[]> {
  // Jika dipaksa atau offline, langsung kembalikan cache
  if (forceCache || !navigator.onLine) {
    const cached = getCached(table);
    if (cached.length > 0) {
      console.info(`fetchAll(${table}): offline — menggunakan cache (${cached.length} baris).`);
      return cached;
    }
    // Cache kosong dan offline: kembalikan array kosong
    console.warn(`fetchAll(${table}): offline dan cache kosong.`);
    return [];
  }

  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  try {
    while (hasMore && page < FETCH_MAX_PAGES) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error(`fetchAll(${table}): error dari Supabase, fallback ke cache.`, error);
        // Fallback ke cache saat ada error jaringan / server
        const cached = getCached(table);
        return cached;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    if (page >= FETCH_MAX_PAGES) {
      console.warn(`fetchAll(${table}): reached max page limit (${FETCH_MAX_PAGES}). Data may be truncated.`);
    }

    // Simpan ke cache setelah berhasil fetch
    if (allData.length > 0) {
      setCache(table, allData);
    }

    return allData;
  } catch (err) {
    // Network error (ERR_INTERNET_DISCONNECTED, dll) — fallback ke cache
    console.warn(`fetchAll(${table}): network error, fallback ke cache.`, err);
    return getCached(table);
  }
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  if (!data?.role) {
    console.warn(`User ${userId} tidak memiliki role di tabel user_roles. Default ke Staff Gudang.`);
    return null;
  }

  return data.role;
}

// Bug #5 & #8 fix: validate file type and size before uploading to prevent
// dangerous file types being stored and to avoid wasting storage quota.
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadProofImage(file: File): Promise<string | null> {
  // Validate MIME type
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error(`Tipe file tidak diizinkan: ${file.type}. Hanya JPG, PNG, WebP, atau GIF.`);
  }

  // Validate extension (defence-in-depth against spoofed MIME types)
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
    throw new Error(`Ekstensi file tidak diizinkan: .${fileExt}. Hanya .jpg, .png, .webp, atau .gif.`);
  }

  // Validate size
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum 5 MB.`);
  }

  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `receipts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('proofs')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading image to Supabase:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('proofs')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function insertAuditTrail(entry: import("../types").AuditTrail) {
  const { error } = await supabase.from('audit_trail').insert(entry);
  if (error) {
    console.error('Failed to insert audit trail:', error);
  }
}
