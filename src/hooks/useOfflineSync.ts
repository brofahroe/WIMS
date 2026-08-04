/**
 * useOfflineSync — hook untuk:
 * 1. Melacak status online/offline secara real-time
 * 2. Menjalankan flushQueue otomatis saat koneksi kembali
 * 3. Mengekspos jumlah item pending di queue
 * 4. Mengekspos fungsi syncNow() untuk sync manual
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { flushQueue, getQueue } from "../lib/offlineQueue";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncNow: () => Promise<void>;
}

export function useOfflineSync(onSyncComplete?: () => void): OfflineSyncState {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => getQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const isSyncingRef = useRef(false);

  // Refresh jumlah pending dari localStorage
  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueue().length);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const { synced, failed } = await flushQueue(supabase);
      if (synced > 0) {
        console.info(`useOfflineSync: ${synced} item berhasil disync.`);
        setLastSyncAt(new Date().toISOString());
        onSyncComplete?.();
      }
      if (failed > 0) {
        console.warn(`useOfflineSync: ${failed} item gagal disync.`);
      }
    } catch (err) {
      console.error("useOfflineSync: sync error", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [onSyncComplete, refreshPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Sedikit delay agar koneksi benar-benar stabil sebelum flush
      setTimeout(() => syncNow(), 1500);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Saat mount, refresh pending count dari localStorage
    refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow, refreshPendingCount]);

  // Poll pending count setiap 5 detik agar badge di header selalu update
  useEffect(() => {
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  return { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow };
}
