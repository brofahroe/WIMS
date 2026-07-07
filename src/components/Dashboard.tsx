import React, { useState } from "react";
import type { ActionEvent, InventoryRow, TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";

interface DashboardProps {
  inventory: InventoryRow[];
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  tempRows: TransactionRecord[];
  events: ActionEvent[];
  onMaterialClick?: (materialName: string) => void;
}

const TX_BADGE: Record<string, string> = {
  INBOUND: "badge-inbound",
  OUTBOUND: "badge-outbound",
  "BORROW IN": "badge-borrow",
  "BORROW OUT": "badge-borrow",
  "TRANSFER IN": "badge-transfer",
  "TRANSFER OUT": "badge-transfer",
  "RETURN IN": "badge-return",
  "RETURN OUT": "badge-return",
};

export function Dashboard({ inventory, logRows, leftoverRows, tempRows, events, onMaterialClick }: DashboardProps) {
  const [timeFilter, setTimeFilter] = useState<"semua" | "bulan" | "minggu" | "hari">("semua");

  const filterByTime = (dateStr: string | undefined | null) => {
    if (timeFilter === "semua" || !dateStr) return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (timeFilter === "hari") {
      return date.toDateString() === now.toDateString();
    } else if (timeFilter === "bulan") {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    } else if (timeFilter === "minggu") {
      const msInDay = 24 * 60 * 60 * 1000;
      const diff = (now.getTime() - date.getTime()) / msInDay;
      return diff >= 0 && diff <= 7;
    }
    return true;
  };

  const filteredLogRows = logRows.filter(r => filterByTime(r.date));
  const filteredLeftoverRows = leftoverRows.filter(r => filterByTime(r.date));

  const totalTx = filteredLogRows.length + filteredLeftoverRows.length;
  const inboundCount = filteredLogRows.filter((r) => (r.transactionType || "").includes("INBOUND")).length;
  const outboundCount = filteredLogRows.filter((r) => (r.transactionType || "").includes("OUTBOUND")).length;
  const activeItemsCount = inventory.length;

  const criticalStock = [...inventory]
    .filter((item) => item.stockWhCalc <= 5)
    .sort((a, b) => a.stockWhCalc - b.stockWhCalc)
    .slice(0, 8);

  const zteStock = inventory.filter((item) => item.typeMaterial === "ZTE Material");
  const emrStock = inventory.filter((item) => item.typeMaterial === "EMR Material");
  const accStock = inventory.filter((item) => item.typeMaterial === "Accessories");

  // Recent transactions (last 5 from logRows)
  const recentTx = [...logRows].reverse().slice(0, 5);

  // Transaction summary by type
  const txSummary: Record<string, number> = {};
  logRows.forEach((r) => {
    const t = r.transactionType || "UNKNOWN";
    txSummary[t] = (txSummary[t] || 0) + 1;
  });

  const renderStockList = (items: InventoryRow[], badgeClass: string, badgeLabel: string, color: string) => (
    <div>
      <span className={`badge ${badgeClass}`} style={{ marginBottom: 8, display: "inline-flex" }}>{badgeLabel}</span>
      {items.slice(0, 3).map((item, idx) => {
        const maxExpected = Math.max(item.stockWhCalc * 1.5, 100);
        const percent = Math.min((item.stockWhCalc / maxExpected) * 100, 100);
        return (
          <React.Fragment key={item.materialCode || idx}>
            <div style={{ fontSize: 12, marginBottom: 3, marginTop: idx > 0 ? 6 : 0, display: "flex", justifyContent: "space-between" }}>
              <span 
                style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                onClick={() => onMaterialClick && onMaterialClick(item.materialName || "")}
              >
                {item.materialName}
              </span>
              <b className={item.stockWhCalc > 0 ? "stock-ok" : item.stockWhCalc === 0 ? "stock-warn" : "stock-low"}>
                {formatNumber(item.stockWhCalc)} {item.leftoversStockCalc > 0 ? <span style={{ color: "var(--orange)", fontSize: 10, marginLeft: 4 }}>(+{formatNumber(item.leftoversStockCalc)} LO)</span> : null}
              </b>
            </div>
            <div className="progress">
              <div className="progress-fill" style={{ width: `${percent}%`, background: `var(--${color})` }}></div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="page active" id="page-dashboard">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as any)} className="input" style={{ width: 200 }}>
          <option value="semua">Semua Waktu</option>
          <option value="bulan">Bulan Ini</option>
          <option value="minggu">7 Hari Terakhir</option>
          <option value="hari">Hari Ini</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Transaksi</div>
          <div className="stat-value" style={{ color: "var(--purple)" }}>{totalTx}</div>
          <div className="stat-sub">Semua tipe</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inbound</div>
          <div className="stat-value" style={{ color: "var(--green)" }}>{inboundCount}</div>
          <div className="stat-sub">Barang masuk</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outbound</div>
          <div className="stat-value" style={{ color: "var(--orange)" }}>{outboundCount}</div>
          <div className="stat-sub">Barang keluar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Item Material</div>
          <div className="stat-value">{activeItemsCount}</div>
          <div className="stat-sub">Aktif di sistem</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="two-col">
        {/* Left Column */}
        <div>
          {/* Critical Stock */}
          <div className="card">
            <div className="card-header"><span className="card-title">⚠ Stok Kritis (≤ 5)</span></div>
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Kode</th>
                  <th>Unit</th>
                  <th>Stok WH</th>
                  <th>Sisa LO</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {criticalStock.map((item) => (
                  <tr key={item.materialCode}>
                    <td>
                      <span 
                        style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                        onClick={() => onMaterialClick && onMaterialClick(item.materialName || "")}
                      >
                        {item.materialName}
                      </span>
                    </td>
                    <td className="mono">{item.materialCode}</td>
                    <td>{item.unit}</td>
                    <td className={item.stockWhCalc <= 0 ? "stock-low" : "stock-warn"}>{formatNumber(item.stockWhCalc)}</td>
                    <td style={{ color: "var(--orange)", fontWeight: 500 }}>{formatNumber(item.leftoversStockCalc)}</td>
                    <td>
                      {item.stockWhCalc < 0 ? (
                        <span className="badge" style={{ background: "#FCEBEB", color: "#791F1F" }}>Minus!</span>
                      ) : item.stockWhCalc === 0 ? (
                        <span className="badge" style={{ background: "#FCEBEB", color: "#791F1F" }}>Habis</span>
                      ) : (
                        <span className="badge badge-transfer">Segera Inbound</span>
                      )}
                    </td>
                  </tr>
                ))}
                {criticalStock.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>Aman, tidak ada stok kritis.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Stock by Category */}
          <div className="card">
            <div className="card-header"><span className="card-title">Ringkasan Stok per Kategori</span></div>
            <div className="three-col">
              {renderStockList(zteStock, "badge-zte", "ZTE Material", "purple")}
              {renderStockList(emrStock, "badge-emr", "EMR Material", "green")}
              {renderStockList(accStock, "badge-acc", "Accessories", "amber")}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Recent Transactions */}
          <div className="card">
            <div className="card-header"><span className="card-title">Transaksi Terakhir</span></div>
            <div>
              {recentTx.length > 0 ? recentTx.map((r, idx) => (
                <div key={r.id || idx} style={{ padding: "8px 0", borderBottom: idx < recentTx.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className={`badge ${TX_BADGE[r.transactionType || ""] || ""}`}>{r.transactionType}</span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>{r.date?.split("T")[0]?.split(" ")[0]}</span>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>
                    {r.materialName} — {formatNumber(r.qty)} {r.unit}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>
                    {r.siteName || "—"} · <span className="mono">{r.notaNo}</span>
                  </div>
                </div>
              )) : (
                <div className="empty-state" style={{ padding: 16, minHeight: "auto" }}>Belum ada transaksi</div>
              )}
            </div>
          </div>

          {/* Transaction Summary by Type */}
          <div className="card">
            <div className="card-header"><span className="card-title">Ringkasan Tipe Transaksi</span></div>
            <table>
              <thead>
                <tr>
                  <th>Tipe Transaksi</th>
                  <th>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(txSummary).map(([type, count]) => (
                  <tr key={type}>
                    <td><span className={`badge ${TX_BADGE[type] || ""}`}>{type}</span></td>
                    <td><strong>{count}</strong></td>
                  </tr>
                ))}
                {Object.keys(txSummary).length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: "center", padding: 16, color: "var(--text3)" }}>Belum ada data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
