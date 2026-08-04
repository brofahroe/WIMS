import { RotateCcw, Warehouse, Menu, LogOut, WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import seedDataJson from "./data/seedData.json";
import { Dashboard } from "./components/Dashboard";
import { InventorySummary } from "./components/InventorySummary";
import { LogTables } from "./components/LogTables";
import { NotaPanel } from "./components/NotaPanel";
import { Sidebar } from "./components/Sidebar";
import { SiteTracker } from "./components/SiteTracker";
import { TransactionWorkspace } from "./components/TransactionWorkspace";
import { MasterMaterial } from "./components/MasterMaterial";
import { ReportExport } from "./components/ReportExport";
import { Leftovers } from "./components/Leftovers";
import { MaterialHistory } from "./components/MaterialHistory";
import { DeliveryOrders } from "./components/DeliveryOrders";
import { DrumHistory } from "./components/DrumHistory";
import { DrumSummary } from "./components/DrumSummary";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { ActionEvent, SeedData, TransactionRecord, ViewKey, User, UserRole } from "./types";
import { LoginPage } from "./components/LoginPage";
import { buildRecentEvents, calculateInventory, createAuditTrail, saveStorage, useSeedOrStorage } from "./lib/wims";
import { supabase, fetchAll, getUserRole, insertAuditTrail } from "./lib/supabase";
import { useIdleTimer } from "./hooks/useIdleTimer";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { enqueueInsert, enqueueUpdate, enqueueDelete } from "./lib/offlineQueue";

const seedData = seedDataJson as unknown as SeedData;

const STORAGE_KEYS = {
  logRows: "wims-web-logRows",
  leftoverRows: "wims-web-leftoverRows",
  tempRows: "wims-web-tempRows",
  events: "wims-web-events",
};

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  inbound: "Input Barang Masuk (Inbound)",
  outbound: "Input Barang Keluar (Outbound)",
  transfer_borrow: "Transfer & Peminjaman",
  inventory: "Stok Material",
  logfile: "Logfile Transaksi",
  leftovers: "Leftovers & LO",
  sites: "Site Database",
  material: "Master Material",
  report: "Laporan & Export",
  nota: "Nota Print",
  material_history: "History Material",
  delivery_orders: "Delivery Orders",
  drum_history: "History Haspel",
  drum_summary: "Summary Haspel",
};

const ROLE_ALLOWED_VIEWS: Record<UserRole, ViewKey[]> = {
  Admin: [
    "dashboard","inbound","outbound","transfer_borrow","inventory","logfile",
    "leftovers","sites","material","report","nota","material_history",
    "delivery_orders","drum_history","drum_summary",
  ],
  Manager: [
    "dashboard","inventory","logfile","sites","material","report",
    "nota","material_history","delivery_orders","drum_history","drum_summary",
  ],
  "Staff Gudang": [
    "dashboard","inbound","outbound","transfer_borrow","inventory",
    "leftovers","sites","report","nota","material_history",
    "delivery_orders","drum_history","drum_summary",
  ],
};

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [selectedDrumNumber, setSelectedDrumNumber] = useState<string | null>(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => window.innerWidth <= 860);
  const [idleWarning, setIdleWarning] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Hybrid cache: sync queue saat kembali online, reload data fresh dari Supabase
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync(
    // Callback saat sync berhasil: reload data agar UI menampilkan data terbaru
    useCallback(() => {
      loadData();
      setSyncToast(`Sinkronisasi selesai — data diperbarui.`);
      setTimeout(() => setSyncToast(null), 4000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );  
  const [master, setMaster] = useState(seedData.master);
  const [materials, setMaterials] = useState(seedData.materials);
  const [deliveryOrders, setDeliveryOrders] = useState(seedData.deliveryOrders);
  const [sites, setSites] = useState(seedData.sites);

  const initialWh = useMemo(() => master.warehouses.find(w => w.whGci?.toLowerCase().includes('malang'))?.whGci || "ALL", [master.warehouses]);
  const [warehouseFilter, setWarehouseFilter] = useState(initialWh);
  const [logRows, setLogRows] = useState<TransactionRecord[]>(() => useSeedOrStorage(STORAGE_KEYS.logRows, seedData.logRows));
  const [leftoverRows, setLeftoverRows] = useState<TransactionRecord[]>(() =>
    useSeedOrStorage(STORAGE_KEYS.leftoverRows, seedData.leftoverRows),
  );
  const [tempRows, setTempRows] = useState<TransactionRecord[]>(() => useSeedOrStorage(STORAGE_KEYS.tempRows, []));
  const [events, setEvents] = useState<ActionEvent[]>(() =>
    useSeedOrStorage(STORAGE_KEYS.events, buildRecentEvents([...seedData.logRows, ...seedData.leftoverRows])),
  );

  const inventory = useMemo(
    () => calculateInventory(materials, logRows, leftoverRows, warehouseFilter),
    [materials, logRows, leftoverRows, warehouseFilter],
  );

  const isSupabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL);

  const loadData = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    
    const [txs, mats, whs, doData, sitesData, settings] = await Promise.all([
      fetchAll('transactions'),
      fetchAll('master_materials'),
      fetchAll('warehouses'),
      fetchAll('delivery_orders'),
      fetchAll('sites'),
      supabase.from('app_settings').select('*').eq('id', 'master').single()
    ]);

    if (txs && txs.length > 0) {
      const active = txs.filter((r: any) => !r.deleted_at);
      setLogRows(active.filter((r: any) => r.source === 'logfile'));
      setLeftoverRows(active.filter((r: any) => r.source === 'leftovers'));
      setEvents(buildRecentEvents(active));
    }
    
    if (mats && mats.length > 0) setMaterials(mats);
    if (doData && doData.length > 0) setDeliveryOrders(doData);
    if (sitesData && sitesData.length > 0) setSites(sitesData);
    
    if (settings.data && whs && whs.length > 0) {
       setMaster({ ...settings.data.data, warehouses: whs });
    }
  }, [isSupabaseEnabled]);

  useEffect(() => {
    loadData();

    if (!isSupabaseEnabled) {
      setCurrentUser({
        id: 'local',
        email: 'local@wims.com',
        role: 'Admin'
      });
      setIsAuthLoading(false);
      return;
    }
    
    // Fallback timeout to ensure the app loads even if Supabase is completely unresponsive
    const fallbackTimeout = setTimeout(() => {
      setIsAuthLoading(false);
    }, 5000);
    
    // Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        try {
          // Timeout for getUserRole in case Supabase is paused/hanging
          const rolePromise = getUserRole(session.user.id);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000));
           const role = await Promise.race([rolePromise, timeoutPromise]) as string | null;
          
          if (!role) {
            console.warn(`Role tidak ditemukan untuk user ${session.user.id}. Silakan jalankan SQL untuk mengatur role di tabel user_roles.`);
          }
          
          setCurrentUser({
            id: session.user.id,
            email: session.user.email || '',
            role: (role === 'Admin' || role === 'Manager' || role === 'Staff Gudang' ? role : 'Staff Gudang') as UserRole
          });
        } catch (error) {
          console.warn("Failed or timed out fetching user role:", error);
          setCurrentUser({
            id: session.user.id,
            email: session.user.email || '',
            role: 'Staff Gudang' // Fallback
          });
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
      clearTimeout(fallbackTimeout);
    });

    return () => {
      clearTimeout(fallbackTimeout);
      subscription.unsubscribe();
    };
  }, [loadData, isSupabaseEnabled]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;
    const channel = supabase
      .channel('realtime-transactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
        const row = payload.new as any;
        if (row.deleted_at) return;
        if (row.source === 'logfile') {
          setLogRows((current) => {
            const exists = current.some((r) => r.id === row.id);
            return exists ? current : [row, ...current];
          });
        } else if (row.source === 'leftovers') {
          setLeftoverRows((current) => {
            const exists = current.some((r) => r.id === row.id);
            return exists ? current : [row, ...current];
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions' }, (payload) => {
        const row = payload.new as any;
        if (row.deleted_at) {
          setLogRows((current) => current.filter((r) => r.id !== row.id));
          setLeftoverRows((current) => current.filter((r) => r.id !== row.id));
          return;
        }
        if (row.source === 'logfile') {
          setLogRows((current) => current.map((r) => r.id === row.id ? row : r));
        } else if (row.source === 'leftovers') {
          setLeftoverRows((current) => current.map((r) => r.id === row.id ? row : r));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, (payload) => {
        const row = payload.old as any;
        setLogRows((current) => current.filter((r) => r.id !== row.id));
        setLeftoverRows((current) => current.filter((r) => r.id !== row.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSupabaseEnabled]);

  // Sinkronisasi isOffline state dengan status jaringan nyata dari useOfflineSync
  useEffect(() => {
    setIsOffline(!isOnline);
  }, [isOnline]);

  useIdleTimer({
    onIdle: () => {
      if (currentUser && isSupabaseEnabled) {
        supabase.auth.signOut();
      }
    },
    onWarning: (remainingMs) => {
      setIdleWarning(true);
      setTimeout(() => setIdleWarning(false), remainingMs);
    },
  });

  useEffect(() => { if (!isSupabaseEnabled) saveStorage(STORAGE_KEYS.logRows, logRows); }, [logRows, isSupabaseEnabled]);
  useEffect(() => { if (!isSupabaseEnabled) saveStorage(STORAGE_KEYS.leftoverRows, leftoverRows); }, [leftoverRows, isSupabaseEnabled]);
  useEffect(() => { saveStorage(STORAGE_KEYS.tempRows, tempRows); }, [tempRows]);
  useEffect(() => { saveStorage(STORAGE_KEYS.events, events); }, [events]);

  const resetLocalData = () => {
    if (!window.confirm("Yakin ingin reset database ke posisi awal (data dari Excel)? Semua input manual akan hilang.")) return;
    setLogRows(seedData.logRows);
    setLeftoverRows(seedData.leftoverRows);
    setDeliveryOrders(seedData.deliveryOrders);
    setTempRows([]);
    setEvents(buildRecentEvents([...seedData.logRows, ...seedData.leftoverRows]));
    alert("Database berhasil di-reset!");
  };

  const handleMaterialClick = useCallback((materialName: string) => {
    setSelectedMaterial(materialName);
    setActiveView("material_history");
  }, []);

  const handleDrumClick = useCallback((drumNumber: string) => {
    setSelectedDrumNumber(drumNumber);
    setActiveView("drum_history");
  }, []);

  const handleViewChange = useCallback((view: ViewKey) => {
    if (!currentUser) return;
    const allowed = ROLE_ALLOWED_VIEWS[currentUser.role] || [];
    if (!allowed.includes(view)) {
      setActiveView("dashboard");
      return;
    }
    setActiveView(view);
  }, [currentUser]);

  const handleUpdateTransaction = async (id: string, updates: Partial<TransactionRecord>) => {
    if (isSupabaseEnabled) {
      if (!isOnline) {
        // Offline: simpan ke queue, update lokal langsung
        enqueueUpdate('transactions', id, updates as Record<string, unknown>);
      } else {
        const { error } = await supabase.from('transactions').update(updates).eq('id', id);
        if (error) {
          console.error("Failed to update transaction:", error);
          alert("Gagal mengupdate transaksi di Supabase");
          return false;
        }
        insertAuditTrail(
          createAuditTrail({
            action: 'UPDATE',
            tableName: 'transactions',
            recordId: id,
            oldValues: null,
            newValues: updates as Record<string, unknown>,
            performedBy: currentUser?.id ?? null,
          }),
        );
      }
    }

    setLogRows((current) =>
      current.map(row => row.id === id ? { ...row, ...updates } : row)
    );
    setLeftoverRows((current) =>
      current.map(row => row.id === id ? { ...row, ...updates } : row)
    );
    return true;
  };

  const handleSoftDeleteTransaction = async (id: string) => {
    if (!window.confirm("Yakin ingin menghapus transaksi ini? Data akan ditandai sebagai dihapus.")) return false;
    const updates = { deleted_at: new Date().toISOString() };
    if (isSupabaseEnabled) {
      if (!isOnline) {
        enqueueDelete('transactions', id);
      } else {
        const { error } = await supabase.from('transactions').update(updates).eq('id', id);
        if (error) {
          console.error("Failed to soft delete transaction:", error);
          alert("Gagal menghapus transaksi di Supabase");
          return false;
        }
        insertAuditTrail(
          createAuditTrail({
            action: 'SOFT_DELETE',
            tableName: 'transactions',
            recordId: id,
            newValues: updates as Record<string, unknown>,
            performedBy: currentUser?.id ?? null,
          }),
        );
      }
    }
    setLogRows((current) => current.filter(row => row.id !== id));
    setLeftoverRows((current) => current.filter(row => row.id !== id));
    return true;
  };

  const handleApproveTransaction = async (id: string) => {
    const updates = { approval_status: "APPROVED" as const, approved_by: currentUser?.id ?? null, approved_at: new Date().toISOString() };
    if (isSupabaseEnabled) {
      const { error } = await supabase.from('transactions').update(updates).eq('id', id);
      if (error) {
        alert("Gagal approve transaksi");
        return;
      }
      insertAuditTrail(
        createAuditTrail({
          action: 'APPROVE',
          tableName: 'transactions',
          recordId: id,
          newValues: updates as Record<string, unknown>,
          performedBy: currentUser?.id ?? null,
        }),
      );
    }
    setLogRows((current) => current.map(row => row.id === id ? { ...row, ...updates } : row));
    setLeftoverRows((current) => current.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const handleRejectTransaction = async (id: string) => {
    if (!window.confirm("Yakin ingin menolak transaksi ini?")) return;
    const updates = { approval_status: "REJECTED" as const, approved_by: currentUser?.id ?? null, approved_at: new Date().toISOString() };
    if (isSupabaseEnabled) {
      const { error } = await supabase.from('transactions').update(updates).eq('id', id);
      if (error) {
        alert("Gagal reject transaksi");
        return;
      }
      insertAuditTrail(
        createAuditTrail({
          action: 'REJECT',
          tableName: 'transactions',
          recordId: id,
          newValues: updates as Record<string, unknown>,
          performedBy: currentUser?.id ?? null,
        }),
      );
    }
    setLogRows((current) => current.map(row => row.id === id ? { ...row, ...updates } : row));
    setLeftoverRows((current) => current.map(row => row.id === id ? { ...row, ...updates } : row));
  };

  const getTransactionGroup = (view: ViewKey): ("INBOUND" | "OUTBOUND" | "TRANSFER" | "BORROW")[] | undefined => {
    switch (view) {
      case "inbound": return ["INBOUND"];
      case "outbound": return ["OUTBOUND"];
      case "transfer_borrow": return ["TRANSFER", "BORROW"];
      default: return undefined;
    }
  };

  const transactionWorkspace = (
    <TransactionWorkspace
      transactionGroups={getTransactionGroup(activeView) as any}
      defaultWarehouse={warehouseFilter}
      master={master}
      materials={materials}
      deliveryOrders={deliveryOrders}
      sites={sites}
      inventory={inventory}
      tempRows={tempRows}
      logRows={logRows}
      leftoverRows={leftoverRows}
      onAddTemp={(row) => setTempRows((current) => [...current, row])}
      onRemoveTemp={(id) => setTempRows((current) => current.filter((row) => row.id !== id))}
      onClearTemp={() => setTempRows([])}
      onProcess={async (result) => {
        setLogRows(result.nextLogRows);
        setLeftoverRows(result.nextLeftoverRows);
        setEvents((current) => [...result.events, ...current].slice(0, 80));
        setTempRows([]);

        if (isSupabaseEnabled && result.newRows && result.newRows.length > 0) {
          if (!isOnline) {
            // Offline: simpan ke antrian, tampilkan notifikasi
            enqueueInsert('transactions', result.newRows);
            setSyncToast(`${result.newRows.length} transaksi disimpan lokal — akan disync saat online.`);
            setTimeout(() => setSyncToast(null), 5000);
            return;
          }

          const { error } = await supabase.from('transactions').insert(result.newRows);
          if (error) {
            console.error("Failed to insert to Supabase:", error);
            // Masukkan ke queue agar bisa di-retry nanti
            enqueueInsert('transactions', result.newRows);
            alert(
              `Transaksi disimpan lokal, tetapi GAGAL disinkronkan ke Supabase.\n\nError: ${error.message || JSON.stringify(error)}\n\nAkan dicoba ulang otomatis saat koneksi stabil.`
            );
            return;
          }
          const auditEntries = result.newRows.map((row) =>
            createAuditTrail({
              action: 'INSERT',
              tableName: 'transactions',
              recordId: row.id,
              newValues: row as unknown as Record<string, unknown>,
              performedBy: currentUser?.id ?? null,
            }),
          );
          await Promise.all(auditEntries.map((entry) => insertAuditTrail(entry)));
        }
      }}
      onPrintNota={() => setActiveView("nota")}
    />
  );

  if (isAuthLoading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading WIMS...</div>;
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <ErrorBoundary
      fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: 'var(--red)' }}>Terjadi kesalahan tidak terduga</h2>
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Muat Ulang Aplikasi</button>
          </div>
        </div>
      }
    >
      <div>
      {/* ── Banner offline ─────────────────────────────────────────────── */}
      {isOffline && (
        <div style={{
          background: '#92400e', color: 'white', textAlign: 'center',
          padding: '6px 16px', fontSize: 13, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <WifiOff size={14} />
          <span>Mode Offline — data ditampilkan dari cache. Transaksi baru akan disimpan lokal dan disync otomatis saat online.</span>
        </div>
      )}

      {/* ── Toast notifikasi sync ───────────────────────────────────────── */}
      {syncToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--green, #10b981)', color: 'white',
          padding: '10px 18px', borderRadius: 8, fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <RefreshCw size={14} />
          {syncToast}
        </div>
      )}

      <header className="app-header">
        <div className="logo">
          <button
            type="button"
            onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
            style={{ display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px' }}
            title="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="WIMS Logo" className="logo-icon" style={{ border: 'none', background: 'transparent', objectFit: 'contain' }} />
          <div className="logo-text">
            <h1>WIMS v3</h1>
            <p>Warehouse Inventory Monitoring System</p>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <span className="hide-mobile" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{currentUser.email}</span>
            <span className="wh-badge" style={{ background: '#0f172a', color: 'white' }}>{currentUser.role}</span>
            <button onClick={() => supabase.auth.signOut()} title="Logout" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
               <LogOut size={16} />
            </button>
          </div>

          {/* ── Status koneksi & pending badge ─────────────────────────── */}
          {isSupabaseEnabled && (
            isOffline ? (
              <span className="wh-badge hide-mobile" style={{ background: '#92400e', color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CloudOff size={12} /> Offline
              </span>
            ) : (
              <span className="wh-badge hide-mobile" style={{ background: "var(--success)", color: "white" }}>☁️ Supabase</span>
            )
          )}

          {/* Badge pending sync — hanya tampil jika ada item di queue */}
          {isSupabaseEnabled && pendingCount > 0 && (
            <button
              className="wh-badge hide-mobile"
              onClick={syncNow}
              disabled={isSyncing || !isOnline}
              title={isOnline ? `Klik untuk sync ${pendingCount} transaksi pending` : 'Akan disync otomatis saat online'}
              style={{
                background: '#d97706', color: 'white', border: 'none', cursor: isOnline ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
            </button>
          )}

          <span className="wh-badge hide-mobile">📍 {warehouseFilter === "ALL" ? "All Warehouses" : warehouseFilter}</span>
          <span className="hide-mobile" style={{ fontSize: 12, color: "var(--text3)" }}>
            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          {currentUser.role !== "Manager" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleViewChange("outbound")}>
              + Transaksi Baru
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
        <Sidebar activeView={activeView} onViewChange={handleViewChange} isMinimized={isSidebarMinimized} role={currentUser.role} />

        <main className="main">
          <div className="page-header">
            <h2 id="page-title">{VIEW_TITLES[activeView]}</h2>
            <div className="actions" id="page-actions">
              <label className="warehouse-select" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Warehouse size={16} />
                <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} style={{ border: 0, outline: 0, background: "transparent", color: "var(--text)" }}>
                  <option value="ALL">All Warehouses</option>
                  {master.warehouses
                    .filter((wh) => wh.whGci)
                    .map((wh) => (
                      <option key={wh.whGci ?? ""} value={wh.whGci ?? ""}>
                        {wh.whGci}
                      </option>
                    ))}
                </select>
              </label>
              {currentUser.role === "Admin" && (
                <button type="button" className="btn btn-sm" onClick={resetLocalData}>
                  <RotateCcw size={14} />
                  Reset DB
                </button>
              )}
            </div>
          </div>

          <div className="content">
            {activeView === "dashboard" ? (
              <Dashboard inventory={inventory} logRows={logRows} leftoverRows={leftoverRows} onMaterialClick={handleMaterialClick} />
            ) : null}
            {["inbound", "outbound", "transfer_borrow"].includes(activeView) ? transactionWorkspace : null}
            {activeView === "inventory" ? (
              <InventorySummary
                inventory={inventory}
                master={master}
                warehouseFilter={warehouseFilter}
                onWarehouseFilterChange={setWarehouseFilter}
                onMaterialClick={handleMaterialClick}
              />
            ) : null}
             {activeView === "logfile" ? <LogTables logRows={logRows} currentUserRole={currentUser.role} onMaterialClick={handleMaterialClick} onDrumClick={handleDrumClick} onUpdateTransaction={handleUpdateTransaction} onSoftDeleteTransaction={handleSoftDeleteTransaction} onApproveTransaction={handleApproveTransaction} onRejectTransaction={handleRejectTransaction} /> : null}
            {activeView === "leftovers" ? <Leftovers leftoverRows={leftoverRows} onMaterialClick={handleMaterialClick} /> : null}
            {activeView === "sites" ? <SiteTracker sites={sites} onRefresh={loadData} /> : null}
            {activeView === "drum_history" && selectedDrumNumber ? (
              <DrumHistory drumNumber={selectedDrumNumber} logRows={logRows} leftoverRows={leftoverRows} onBack={() => setActiveView("dashboard")} />
            ) : null}
            {activeView === "drum_summary" ? (
              <DrumSummary logRows={logRows} leftoverRows={leftoverRows} onDrumClick={handleDrumClick} />
            ) : null}
            {activeView === "delivery_orders" ? <DeliveryOrders orders={deliveryOrders} master={master} logRows={logRows} onRefresh={loadData} /> : null}
            {activeView === "material" ? <MasterMaterial materials={materials} onMaterialClick={handleMaterialClick} onRefresh={loadData} /> : null}
            {activeView === "material_history" && selectedMaterial ? (
              <MaterialHistory materialName={selectedMaterial} logRows={logRows} leftoverRows={leftoverRows} onDrumClick={handleDrumClick} onBack={() => setActiveView("dashboard")} />
            ) : null}
            {activeView === "report" ? (
              <ReportExport 
                logRows={logRows} 
                inventory={inventory} 
                sites={sites} 
                materials={materials} 
                onImport={(rows) => { setLogRows(rows); }} 
              />
            ) : null}
            {activeView === "nota" ? <NotaPanel logRows={logRows} /> : null}
          </div>
        </main>
      </div>
      {idleWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 12, maxWidth: 400, textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>Sesi Akan Berakhir</h3>
            <p style={{ color: 'var(--text2)' }}>Anda akan otomatis logout dalam 2 menit karena tidak ada aktivitas.</p>
            <button type="button" className="btn btn-primary" onClick={() => setIdleWarning(false)}>Tetap Masuk</button>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default App;

