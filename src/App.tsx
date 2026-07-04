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
import type { ActionEvent, SeedData, TransactionRecord, ViewKey, User } from "./types";
import { LoginPage } from "./components/LoginPage";
import { buildRecentEvents, calculateInventory, saveStorage, useSeedOrStorage } from "./lib/wims";
import { supabase, fetchAll, getUserRole } from "./lib/supabase";

const seedData = seedDataJson as SeedData;

const STORAGE_KEYS = {
  logRows: "wims-web-logRows",
  leftoverRows: "wims-web-leftoverRows",
  tempRows: "wims-web-tempRows",
  events: "wims-web-events",
};

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  transactions: "Input Transaksi",
  inventory: "Stok Material",
  logfile: "Logfile Transaksi",
  leftovers: "Leftovers & LO",
  sites: "Site Database",
  material: "Master Material",
  report: "Laporan & Export",
  nota: "Nota Print",
  material_history: "History Material",
  delivery_orders: "Delivery Orders",
};

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  
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
    
    // Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const role = await getUserRole(session.user.id);
        setCurrentUser({
          id: session.user.id,
          email: session.user.email || '',
          role: (role as any) || 'Staff Gudang' // Default fallback
        });
      } else {
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData]);

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

  const handleMaterialClick = (materialName: string) => {
    setSelectedMaterial(materialName);
    setActiveView("material_history");
  };

  const transactionWorkspace = (
    <TransactionWorkspace
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
          <div className="logo-icon">W</div>
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
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setActiveView("transactions")}>
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
            {activeView === "transactions" ? transactionWorkspace : null}
            {activeView === "inventory" ? (
              <InventorySummary
                inventory={inventory}
                master={master}
                warehouseFilter={warehouseFilter}
                onWarehouseFilterChange={setWarehouseFilter}
                onMaterialClick={handleMaterialClick}
              />
            ) : null}
            {activeView === "logfile" ? <LogTables logRows={logRows} leftoverRows={leftoverRows} events={events} onMaterialClick={handleMaterialClick} /> : null}
            {activeView === "leftovers" ? <Leftovers leftoverRows={leftoverRows} onMaterialClick={handleMaterialClick} /> : null}
            {activeView === "sites" ? <SiteTracker sites={sites} onRefresh={loadData} /> : null}
            {activeView === "delivery_orders" ? <DeliveryOrders orders={deliveryOrders} master={master} logRows={logRows} onRefresh={loadData} /> : null}
            {activeView === "material" ? <MasterMaterial materials={materials} onMaterialClick={handleMaterialClick} onRefresh={loadData} /> : null}
            {activeView === "material_history" && selectedMaterial ? (
              <MaterialHistory materialName={selectedMaterial} logRows={logRows} leftoverRows={leftoverRows} onBack={() => setActiveView("dashboard")} />
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

