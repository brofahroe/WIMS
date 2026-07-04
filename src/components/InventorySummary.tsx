import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { InventoryRow, MasterData } from "../types";
import { formatNumber, normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface InventorySummaryProps {
  inventory: InventoryRow[];
  master: MasterData;
  warehouseFilter: string;
  onWarehouseFilterChange: (value: string) => void;
  onMaterialClick?: (materialName: string) => void;
}

export function InventorySummary({
  inventory,
  warehouseFilter,
  onWarehouseFilterChange,
  onMaterialClick,
}: InventorySummaryProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // "" means all, or "stok0"

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();
    return inventory
      .filter((row) => {
        if (typeFilter === "stok0") return row.stockWhCalc <= 0;
        if (typeFilter && typeFilter !== "stok0") return row.typeMaterial === typeFilter;
        return true;
      })
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [row.materialCode, row.materialName, row.typeMaterial, row.addRemark]
          .some((value) => normalizeText(value).toLowerCase().includes(normalizedQuery));
      });
  }, [inventory, query, typeFilter]);

  const { items: sortedItems, requestSort, sortConfig } = useSortableData(filtered);

  const handleExportCsv = () => {
    const headers = ["Kode", "Nama Material", "Tipe", "Unit", "Inbound", "Outbound", "TF IN", "TF OUT", "BR IN", "BR OUT", "Stok WH", "LO Stok", "Keterangan"];
    const rows = filtered.map((m) => [
      `"${m.materialCode || ""}"`,
      `"${m.materialName || ""}"`,
      `"${m.typeMaterial || ""}"`,
      `"${m.unit || ""}"`,
      `"${m.inboundCalc || 0}"`,
      `"${m.outboundCalc || 0}"`,
      `"${m.transferInCalc || 0}"`,
      `"${m.transferOutCalc || 0}"`,
      `"${m.borrowInCalc || 0}"`,
      `"${m.borrowOutCalc || 0}"`,
      `"${m.stockWhCalc || 0}"`,
      `"${m.leftoversStockCalc || 0}"`,
      `"${m.addRemark || ""}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "WIMS_Stok.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page active" id="page-stok">
      <div className="filters-bar" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="search-field" style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Cari kode atau nama material..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 34, width: "100%", height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <button className="btn" onClick={handleExportCsv} style={{ height: 36 }}>
          <Download size={16} style={{ marginRight: 6 }} /> Export CSV
        </button>
      </div>

      <div className="chips" id="stok-chips" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`chip ${typeFilter === "" ? "active" : ""}`} onClick={() => setTypeFilter("")}>
          Semua Material
        </button>
        <button className={`chip ${typeFilter === "ZTE Material" ? "active" : ""}`} onClick={() => setTypeFilter("ZTE Material")}>
          ZTE Material
        </button>
        <button className={`chip ${typeFilter === "EMR Material" ? "active" : ""}`} onClick={() => setTypeFilter("EMR Material")}>
          EMR Material
        </button>
        <button className={`chip ${typeFilter === "Accessories" ? "active" : ""}`} onClick={() => setTypeFilter("Accessories")}>
          Accessories
        </button>
        <button className={`chip ${typeFilter === "stok0" ? "active" : ""}`} onClick={() => setTypeFilter("stok0")}>
          ⚠ Stok ≤ 0
        </button>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        <span>💡</span>
        <div style={{ flex: 1 }}>
          <strong>Formula:</strong> Stok WH = (Inbound + Transfer IN + Borrow IN) — (Outbound + Transfer OUT + Borrow OUT)
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table id="stok-table">
            <thead>
              <tr>
                <SortableHeader label="Kode" sortKey="materialCode" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nama Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tipe" sortKey="typeMaterial" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Inbound" sortKey="inboundCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Outbound" sortKey="outboundCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="TF IN" sortKey="transferInCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="TF OUT" sortKey="transferOutCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="BR IN" sortKey="borrowInCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="BR OUT" sortKey="borrowOutCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Stok WH" sortKey="stockWhCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="LO Stok" sortKey="leftoversStockCalc" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Keterangan" sortKey="addRemark" currentSort={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((row) => (
                <tr key={`${row.materialCode}-${row.materialName}`}>
                  <td className="mono">{row.materialCode}</td>
                  <td>
                    <span 
                      style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                      onClick={() => onMaterialClick && onMaterialClick(row.materialName || "")}
                    >
                      {row.materialName}
                    </span>
                  </td>
                  <td>{row.typeMaterial}</td>
                  <td>{row.unit}</td>
                  <td className="numeric">{formatNumber(row.inboundCalc)}</td>
                  <td className="numeric">{formatNumber(row.outboundCalc)}</td>
                  <td className="numeric">{formatNumber(row.transferInCalc)}</td>
                  <td className="numeric">{formatNumber(row.transferOutCalc)}</td>
                  <td className="numeric">{formatNumber(row.borrowInCalc)}</td>
                  <td className="numeric">{formatNumber(row.borrowOutCalc)}</td>
                  <td className={`numeric ${row.stockWhCalc < 0 ? "stock-low" : row.stockWhCalc === 0 ? "stock-warn" : "stock-ok"}`}>
                    <b>{formatNumber(row.stockWhCalc)}</b>
                  </td>
                  <td className="numeric">
                    <b style={{ color: row.leftoversStockCalc > 0 ? "var(--purple)" : "inherit" }}>
                      {formatNumber(row.leftoversStockCalc)}
                    </b>
                  </td>
                  <td style={{ fontSize: 11 }}>{row.addRemark || "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={13} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada data stok yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
