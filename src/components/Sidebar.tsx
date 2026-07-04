import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ClipboardList,
  Database,
  Handshake,
  LayoutDashboard,
  MapPin,
  PackageOpen,
  ReceiptText,
  Repeat,
  Truck
} from "lucide-react";
import type { ViewKey, UserRole } from "../types";

interface SidebarProps {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  sourceWorkbook: string;
  isMinimized?: boolean;
  role?: UserRole;
}

export function Sidebar({ activeView, onViewChange, sourceWorkbook, isMinimized = false, role = "Admin" }: SidebarProps) {
  let navItemsUtama: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  let navItemsTransaksi: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "inbound", label: "Barang Masuk", icon: ArrowDownToLine },
    { key: "outbound", label: "Barang Keluar", icon: ArrowUpFromLine },
    { key: "transfer", label: "Transfer Gudang", icon: Repeat },
    { key: "borrow", label: "Peminjaman", icon: Handshake },
  ];

  let navItemsData: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "logfile", label: "Logfile Transaksi", icon: Database },
    { key: "inventory", label: "Stok Material", icon: PackageOpen },
    { key: "leftovers", label: "Leftovers & LO", icon: ReceiptText },
  ];

  let navItemsRef: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "material", label: "Master Material", icon: Database },
    { key: "sites", label: "Site Database", icon: MapPin },
    { key: "delivery_orders", label: "Delivery Orders", icon: Truck },
    { key: "report", label: "Laporan & Export", icon: ClipboardList },
  ];

  if (role === "Manager") {
    navItemsTransaksi = [];
    navItemsData = navItemsData.filter(item => item.key !== "leftovers");
  } else if (role === "Staff Gudang") {
    navItemsData = navItemsData.filter(item => item.key !== "logfile");
    navItemsRef = [];
  }

  const renderNavGroup = (title: string, items: typeof navItemsUtama) => {
    if (items.length === 0) return null;
    return (
      <>
        <div className="nav-section">{title}</div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${activeView === item.key ? "is-active" : ""}`}
              onClick={() => onViewChange(item.key)}
              title={isMinimized ? item.label : undefined}
            >
              <Icon size={16} />
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <aside className={`sidebar ${isMinimized ? 'is-minimized' : ''}`}>
      {renderNavGroup("Utama", navItemsUtama)}
      {renderNavGroup("Transaksi", navItemsTransaksi)}
      {renderNavGroup("Data", navItemsData)}
      {renderNavGroup("Referensi", navItemsRef)}

      <div className="sidebar-footer">
        <div><b>Role:</b> {role}</div>
        <div style={{ marginTop: 4 }}><b>WIMS</b> v3 — {sourceWorkbook}</div>
      </div>
    </aside>
  );
}
