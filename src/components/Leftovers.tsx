import React from "react";
import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber, normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface LeftoversProps {
  leftoverRows: TransactionRecord[];
  onMaterialClick?: (materialName: string) => void;
}

export function Leftovers({ leftoverRows, onMaterialClick }: LeftoversProps) {
  const [query, setQuery] = useState("");
  const [qtyFilter, setQtyFilter] = useState("all");
  const warehouses = useMemo(() => Array.from(new Set(leftoverRows.map(r => r.whGci).filter(Boolean))), [leftoverRows]);
  const [whFilter, setWhFilter] = useState(() => warehouses.find(w => w?.toLowerCase().includes('malang')) || "all");

  // Aggregate leftovers by material
  const summary: Record<string, { inb: number; out: number; unit: string }> = {};
  leftoverRows.forEach((r) => {
    const mat = r.materialName || "Unknown";
    if (!summary[mat]) summary[mat] = { inb: 0, out: 0, unit: r.unit || "" };
    if ((r.transactionType || "").includes("INBOUND") || r.transactionType === "RETURN IN") {
      summary[mat].inb += r.qty;
    } else {
      summary[mat].out += r.qty;
    }
  });

  const filteredRows = useMemo(() => {
    return leftoverRows
      .filter((r) => {
        const matchesQuery =
          normalizeText(r.materialName || "").includes(normalizeText(query)) ||
          normalizeText(r.notaNo || "").includes(normalizeText(query)) ||
          normalizeText(r.tagId || "").includes(normalizeText(query));
        const matchesQty =
          qtyFilter === "all" ||
          (qtyFilter === "scrap" && r.qty < 100) ||
          (qtyFilter === "100" && r.qty >= 100 && r.qty < 200) ||
          (qtyFilter === "200" && r.qty >= 200 && r.qty < 500) ||
          (qtyFilter === "500" && r.qty >= 500 && r.qty < 1000) ||
          (qtyFilter === "1000" && r.qty >= 1000 && r.qty < 1500) ||
          (qtyFilter === "1500" && r.qty >= 1500);
        const matchesWh = whFilter === "all" || r.whGci === whFilter;
        return matchesQuery && matchesQty && matchesWh;
      });
  }, [query, leftoverRows, qtyFilter, whFilter]);

  const { items: sortedLeftovers, requestSort, sortConfig } = useSortableData(filteredRows, { key: "date", direction: "descending" });

  const handleExportCsv = () => {
    const headers = ["Tag ID", "Tipe", "Nota No", "Tanggal", "Material", "Qty", "Unit", "Site ID", "Cable Marker", "PIC"];
    const csvContent = [
      headers.join(","),
      ...sortedLeftovers.map(r => [r.tagId, r.transactionType, r.notaNo, r.date?.split(" ")[0]?.split("T")[0], r.materialName, r.qty, r.unit, r.siteId, r.cableLengthMarker, r.picDelivery].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leftovers.csv";
    a.click();
  };

  const sortedSummary = Object.entries(summary).sort();

  return (
    <div className="page active" id="page-leftovers">
      <div className="alert alert-warning" style={{ marginBottom: 20 }}>
        <span>⚠️</span>
        <div style={{ flex: 1 }}>
          <strong>Penting:</strong> Leftovers adalah sisa material kabel potongan per drum/roll yang dikembalikan dari site. Stok leftovers dihitung terpisah dari stok utama (Material Utuh).
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Stok Summary Leftovers</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th style={{ textAlign: "right" }}>LO In</th>
                    <th style={{ textAlign: "right" }}>LO Out</th>
                    <th style={{ textAlign: "right" }}>Net Stok</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummary.map(([mat, data]) => {
                    const net = data.inb - data.out;
                    return (
                      <tr key={mat}>
                        <td>
                          <span 
                            style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                            onClick={() => onMaterialClick && onMaterialClick(mat)}
                          >
                            {mat}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>{formatNumber(data.inb)}</td>
                        <td style={{ textAlign: "right" }}>{formatNumber(data.out)}</td>
                        <td style={{ textAlign: "right" }}>
                          <b style={{ color: net > 0 ? "var(--green)" : "inherit" }}>{formatNumber(net)}</b>
                        </td>
                        <td>{data.unit}</td>
                      </tr>
                    );
                  })}
                  {sortedSummary.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--text3)" }}>Belum ada data leftovers</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Kriteria Sisa Kabel (Leftovers)</span></div>
            <table>
              <thead>
                <tr>
                  <th>Kriteria</th>
                  <th>Panjang Roll</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge" style={{ background: "var(--red-light)", color: "var(--red)" }}>&lt; 100</span></td>
                  <td>Kurang dari 100 meter (Scrap)</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>&gt; 100</span></td>
                  <td>100m – 199m</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>&gt; 200</span></td>
                  <td>200m – 499m</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>&gt; 500</span></td>
                  <td>500m – 999m</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: "var(--purple-light)", color: "var(--purple)" }}>&gt; 1000</span></td>
                  <td>1000m – 1499m</td>
                </tr>
                <tr>
                  <td><span className="badge" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>&gt; 1500</span></td>
                  <td>Lebih dari 1500m</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Logfile Detail Leftovers & LO</span>
          <div className="card-actions">
            <button className="btn btn-sm" onClick={handleExportCsv}><Download size={16} /> Export</button>
          </div>
        </div>
        <div className="table-controls" style={{ padding: "10px 16px", display: "flex", gap: 10 }}>
          <div className="search-wrap"><Search size={16} /><input placeholder="Cari..." onChange={(e) => setQuery(e.target.value)} /></div>
          <select onChange={(e) => setQtyFilter(e.target.value)}>
            <option value="all">Semua Qty</option>
            <option value="scrap">Scrap (&lt; 100)</option>
            <option value="100">100-199m</option>
            <option value="200">200-499m</option>
            <option value="500">500-999m</option>
            <option value="1000">1000-1499m</option>
            <option value="1500">&gt; 1500m</option>
          </select>
        </div>
        <div className="table-wrap">
          <table id="lo-table">
            <thead>
              <tr>
                <th>#</th>
                <SortableHeader label="Tag ID" sortKey="tagId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tipe" sortKey="transactionType" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nota No." sortKey="notaNo" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tanggal" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Cable Marker" sortKey="cableLengthMarker" currentSort={sortConfig} requestSort={requestSort} />
                <th>Kriteria</th>
                <SortableHeader label="PIC" sortKey="picDelivery" currentSort={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedLeftovers.map((r, idx) => {
                const getCriteriaBadge = (qty: number) => {
                  if (qty < 100) return <span className="badge" style={{ background: "var(--red-light)", color: "var(--red)" }}>&lt; 100</span>;
                  if (qty < 200) return <span className="badge" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>&gt; 100</span>;
                  if (qty < 500) return <span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>&gt; 200</span>;
                  if (qty < 1000) return <span className="badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>&gt; 500</span>;
                  if (qty < 1500) return <span className="badge" style={{ background: "var(--purple-light)", color: "var(--purple)" }}>&gt; 1000</span>;
                  return <span className="badge" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>&gt; 1500</span>;
                };

                return (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td>
                      {r.tagId ? <span className="lo-tag mono">{r.tagId}</span> : "-"}
                    </td>
                    <td><span className={`badge ${r.transactionType?.includes("INBOUND") ? "badge-inbound" : "badge-outbound"}`}>{r.transactionType}</span></td>
                    <td className="mono">{r.notaNo}</td>
                    <td>{r.date?.split(" ")[0]?.split("T")[0]}</td>
                    <td>
                      <span 
                        style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                        onClick={() => onMaterialClick && onMaterialClick(r.materialName || "")}
                      >
                        {r.materialName}
                      </span>
                    </td>
                    <td className="mono"><b>{formatNumber(r.qty)}</b></td>
                    <td>{r.unit}</td>
                    <td>{r.siteId || "-"}</td>
                    <td>{r.cableLengthMarker || "-"}</td>
                    <td>{getCriteriaBadge(r.qty)}</td>
                    <td>{r.picDelivery || "-"}</td>
                  </tr>
                );
              })}
              {leftoverRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada data leftovers
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
