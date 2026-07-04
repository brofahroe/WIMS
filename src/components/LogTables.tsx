import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber, normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface LogTablesProps {
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[]; // Kept for signature, but unused in UI
  events: any[]; // Kept for signature, but unused in UI
  onMaterialClick?: (materialName: string) => void;
}

export function LogTables({ logRows, onMaterialClick }: LogTablesProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  
  const warehouses = useMemo(() => Array.from(new Set(logRows.map(r => r.whGci).filter(Boolean))), [logRows]);
  const [whFilter, setWhFilter] = useState(() => warehouses.find(w => w?.toLowerCase().includes('malang')) || "ALL");

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();
    return [...logRows]
      .filter((row) => {
        if (typeFilter !== "ALL" && row.transactionType !== typeFilter) return false;
        if (whFilter !== "ALL" && row.whGci !== whFilter) return false;
        if (!normalizedQuery) return true;
        return [row.notaNo, row.materialName, row.siteId, row.materialCode, row.siteName]
          .some((value) => normalizeText(value).toLowerCase().includes(normalizedQuery));
      });
  }, [query, logRows, typeFilter, whFilter]);

  const { items: sortedRows, requestSort, sortConfig } = useSortableData(filteredRows, { key: "date", direction: "descending" });

  const handleExportCsv = () => {
    const headers = ["#", "Tipe", "Nota No.", "WH", "Tanggal", "Source/Dest", "Material", "Kode", "Qty", "Unit", "Drum No.", "Site ID", "DO Number", "Kondisi", "PIC Del.", "Vendor", "Ket."];
    const rows = filteredRows.map((r, idx) => [
      `${idx + 1}`,
      `"${r.transactionType || ""}"`,
      `"${r.notaNo || ""}"`,
      `"${r.whGci || ""}"`,
      `"${r.date?.split(" ")[0]?.split("T")[0] || ""}"`,
      `"${r.sourceDestination || ""}"`,
      `"${r.materialName || ""}"`,
      `"${r.materialCode || ""}"`,
      `"${r.qty || 0}"`,
      `"${r.unit || ""}"`,
      `"${r.drumNumber || ""}"`,
      `"${r.siteId || ""}"`,
      `"${r.doNumber || ""}"`,
      `"${r.condition || ""}"`,
      `"${r.picDelivery || ""}"`,
      `"${r.vendorSupplier || ""}"`,
      `"${(r.remarks || "").replace(/\n/g, " ")}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "WIMS_Logfile.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const types = ["INBOUND", "OUTBOUND", "BORROW IN", "BORROW OUT", "TRANSFER IN", "TRANSFER OUT", "RETURN IN", "RETURN OUT"];

  return (
    <div className="page active" id="page-logfile">
      <div className="filters-bar" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="search-field" style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Cari no nota, material, atau site ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 34, width: "100%", height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <option value="ALL">Semua Tipe</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select 
          value={whFilter} 
          onChange={(e) => setWhFilter(e.target.value)}
          style={{ height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <option value="ALL">Semua WH</option>
          {warehouses.map(w => <option key={w as string} value={w as string}>{w as string}</option>)}
        </select>
        <button className="btn" onClick={handleExportCsv} style={{ height: 36 }}>
          <Download size={16} style={{ marginRight: 6 }} /> Export CSV
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table id="log-table">
            <thead>
              <tr>
                <th>#</th>
                <SortableHeader label="Tipe" sortKey="transactionType" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nota No." sortKey="notaNo" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="WH" sortKey="whGci" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tanggal" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Source/Dest" sortKey="source" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Kode" sortKey="materialCode" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Drum No." sortKey="drumNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="DO Number" sortKey="doNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Kondisi" sortKey="condition" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="PIC Del." sortKey="picDelivery" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Vendor" sortKey="vendorSupplier" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Ket." sortKey="remarks" currentSort={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--text3)" }}>{String(idx + 1).padStart(3, '0')}</td>
                  <td><span className={`badge ${row.transactionType?.includes("INBOUND") ? "badge-inbound" : "badge-outbound"}`}>{row.transactionType}</span></td>
                  <td className="mono">{row.notaNo}</td>
                  <td style={{ color: "var(--blue)" }}>{row.whGci}</td>
                  <td>{row.date?.split(" ")[0]?.split("T")[0]}</td>
                  <td>{row.sourceDestination || "-"}</td>
                  <td>
                    <b 
                      style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                      onClick={() => onMaterialClick && onMaterialClick(row.materialName || "")}
                    >
                      {row.materialName}
                    </b>
                  </td>
                  <td className="mono">{row.materialCode}</td>
                  <td className="numeric"><b>{formatNumber(row.qty)}</b></td>
                  <td>{row.unit}</td>
                  <td className="mono">{row.drumNumber || "-"}</td>
                  <td>{row.siteId || "-"}</td>
                  <td className="mono">{row.doNumber || "-"}</td>
                  <td>{row.condition || "-"}</td>
                  <td>{row.picDelivery || "-"}</td>
                  <td>{row.vendorSupplier || "-"}</td>
                  <td style={{ fontSize: 11 }}>{row.remarks || "-"}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={17} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada transaksi yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div id="log-count" style={{ fontSize: 12, color: "var(--text3)", marginTop: 12, textAlign: "right" }}>
        Menampilkan {filteredRows.length} dari {logRows.length} transaksi
      </div>
    </div>
  );
}
