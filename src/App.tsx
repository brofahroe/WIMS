import { RotateCcw, Warehouse, Menu, LogOut } from "lucide-react";
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
import { SiteSummaryOutbound } from "./components/SiteSummaryOutbound";
import { DrumHistory } from "./components/DrumHistory";
import type { ActionEvent, SeedData, TransactionRecord, ViewKey, User } from "./types";
import { LoginPage } from "./components/LoginPage";
import { buildRecentEvents, calculateInventory, saveStorage, useSeedOrStorage } from "./lib/wims";
import { supabase, fetchAll, getUserRole } from "./lib/supabase";

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
  transfer: "Transfer Gudang",
  borrow: "Peminjaman / Pengembalian",
  inventory: "Stok Material",
  logfile: "Logfile Transaksi",
  leftovers: "Leftovers & LO",
  sites: "Site Database",
  material: "Master Material",
  report: "Laporan & Export",
  nota: "Nota Print",
  material_history: "History Material",
  delivery_orders: "Delivery Orders",
  site_summary: "Summary Outbound Site",
  drum_history: "History Haspel",
};

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [selectedDrumNumber, setSelectedDrumNumber] = useState<string | null>(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => window.innerWidth <= 860);
  
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
      setLogRows(txs.filter((r: any) => r.source === 'logfile'));
      setLeftoverRows(txs.filter((r: any) => r.source === 'leftovers'));
      setEvents(buildRecentEvents(txs));
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
          
          setCurrentUser({
            id: session.user.id,
            email: session.user.email || '',
            role: (role as any) || 'Staff Gudang'
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

  const handleUpdateTransaction = async (id: string, updates: Partial<TransactionRecord>) => {
    if (isSupabaseEnabled) {
      const { error } = await supabase.from('transactions').update(updates).eq('id', id);
      if (error) {
        console.error("Failed to update transaction:", error);
        alert("Gagal mengupdate transaksi di Supabase");
        return false;
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

  const getTransactionGroup = (view: ViewKey) => {
    switch (view) {
      case "inbound": return "INBOUND";
      case "outbound": return "OUTBOUND";
      case "transfer": return "TRANSFER";
      case "borrow": return "BORROW";
      default: return undefined;
    }
  };

  const transactionWorkspace = (
    <TransactionWorkspace
      transactionGroup={getTransactionGroup(activeView)}
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
          const { error } = await supabase.from('transactions').insert(result.newRows);
          if (error) {
            console.error("Failed to insert to Supabase:", error);
            alert("Gagal menyimpan ke Supabase. Silakan cek koneksi atau console.");
          }
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
    <div>
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
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{currentUser.email}</span>
            <span className="wh-badge" style={{ background: '#0f172a', color: 'white' }}>{currentUser.role}</span>
            <button onClick={() => supabase.auth.signOut()} title="Logout" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text2)' }}>
               <LogOut size={16} />
            </button>
          </div>
          {isSupabaseEnabled && <span className="wh-badge" style={{ background: "var(--success)", color: "white" }}>☁️ Supabase</span>}
          <span className="wh-badge">📍 {warehouseFilter === "ALL" ? "All Warehouses" : warehouseFilter}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>
            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </span>
          {currentUser.role !== "Manager" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveView("outbound")}>
              + Transaksi Baru
            </button>
          )}
        </div>
      </header>

      <div className="app-body">
        <Sidebar activeView={activeView} onViewChange={setActiveView} sourceWorkbook={seedData.sourceWorkbook} isMinimized={isSidebarMinimized} role={currentUser.role} />

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
              <Dashboard inventory={inventory} logRows={logRows} leftoverRows={leftoverRows} tempRows={tempRows} events={events} onMaterialClick={handleMaterialClick} />
            ) : null}
            {["inbound", "outbound", "transfer", "borrow"].includes(activeView) ? transactionWorkspace : null}
            {activeView === "inventory" ? (
              <InventorySummary
                inventory={inventory}
                master={master}
                warehouseFilter={warehouseFilter}
                onWarehouseFilterChange={setWarehouseFilter}
                onMaterialClick={handleMaterialClick}
              />
            ) : null}
            {activeView === "logfile" ? <LogTables logRows={logRows} leftoverRows={leftoverRows} events={events} onMaterialClick={handleMaterialClick} onDrumClick={handleDrumClick} onUpdateTransaction={handleUpdateTransaction} /> : null}
            {activeView === "leftovers" ? <Leftovers leftoverRows={leftoverRows} onMaterialClick={handleMaterialClick} /> : null}
            {activeView === "sites" ? <SiteTracker sites={sites} onRefresh={loadData} /> : null}
            {activeView === "site_summary" ? <SiteSummaryOutbound logRows={logRows} leftoverRows={leftoverRows} /> : null}
            {activeView === "drum_history" && selectedDrumNumber ? (
              <DrumHistory drumNumber={selectedDrumNumber} logRows={logRows} leftoverRows={leftoverRows} onBack={() => setActiveView("dashboard")} />
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
    </div>
  );
}

export default App;

