import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber, normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface SiteSummaryOutboundProps {
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
}

export function SiteSummaryOutbound({ logRows, leftoverRows }: SiteSummaryOutboundProps) {
  const [query, setQuery] = useState("");

  const summaryData = useMemo(() => {
    const allRows = [...logRows, ...leftoverRows];
    const grouped = new Map<string, any>();

    for (const row of allRows) {
      const type = (row.transactionType || "").toUpperCase();
      if (!type.includes("OUT") && !type.includes("KELUAR") && !type.includes("PEMINJAMAN")) continue;
      
      const siteId = row.siteId || "-";
      const siteName = row.siteName || "-";
      
      if (siteId === "-" && siteName === "-") continue;

      const materialName = row.materialName || "Unknown";
      const unit = row.unit || "";
      const qty = Number(row.qty) || 0;
      
      const key = `${siteId}_${siteName}_${materialName}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          siteId,
          siteName,
          materialName,
          unit,
          qty: 0,
        });
      }
      
      grouped.get(key).qty += qty;
    }
    
    return Array.from(grouped.values());
  }, [logRows, leftoverRows]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) return summaryData;
    
    return summaryData.filter(item => 
      [item.siteId, item.siteName, item.materialName]
        .some(val => normalizeText(val).toLowerCase().includes(normalizedQuery))
    );
  }, [summaryData, query]);

  const { items: sortedData, requestSort, sortConfig } = useSortableData(filtered);

  const handleExportCsv = () => {
    const headers = ["Site ID", "Site Name", "Material Name", "Total Qty", "Unit"];
    const csvRows = sortedData.map(r => [
      `"${r.siteId}"`,
      `"${r.siteName}"`,
      `"${r.materialName}"`,
      `"${r.qty}"`,
      `"${r.unit}"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Summary_Outbound_Site.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Summary Outbound Per Site</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-container" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari Site ID, Nama Site, atau Material..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
              <SortableHeader label="Site Name" sortKey="siteName" currentSort={sortConfig} requestSort={requestSort} />
              <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
              <SortableHeader label="Total Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
              <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr key={row.id}>
                <td>{idx + 1}</td>
                <td>{row.siteId}</td>
                <td>{row.siteName}</td>
                <td>{row.materialName}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{formatNumber(row.qty)}</td>
                <td>{row.unit}</td>
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                  Tidak ada data yang ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
