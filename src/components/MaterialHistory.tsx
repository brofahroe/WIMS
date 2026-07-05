import { ArrowLeft, Download } from "lucide-react";
import { useMemo } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface MaterialHistoryProps {
  materialName: string;
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  onBack: () => void;
}

export function MaterialHistory({ materialName, logRows, leftoverRows, onBack }: MaterialHistoryProps) {
  // Combine all history related to this material
  const historyRows = useMemo(() => {
    const logs = logRows.filter((r) => r.materialName === materialName);
    const leftovers = leftoverRows.filter((r) => r.materialName === materialName);
    return [...logs, ...leftovers].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [materialName, logRows, leftoverRows]);

  const { items: sortedRows, requestSort, sortConfig } = useSortableData(historyRows, { key: "date", direction: "descending" });

  const handleExportCsv = () => {
    const headers = ["Tipe", "Nota No.", "WH", "Tanggal", "Source/Dest", "Kode", "Qty", "Unit", "Tagging", "Kondisi", "PIC", "Ket."];
    const rows = sortedRows.map((r) => [
      `"${r.transactionType || ""}"`,
      `"${r.notaNo || ""}"`,
      `"${r.whGci || ""}"`,
      `"${r.date?.split(" ")[0]?.split("T")[0] || ""}"`,
      `"${r.sourceDestination || ""}"`,
      `"${r.materialCode || ""}"`,
      `"${r.qty || 0}"`,
      `"${r.unit || ""}"`,
      `"${r.taggingType || ""}"`,
      `"${r.condition || ""}"`,
      `"${r.picDelivery || ""}"`,
      `"${(r.remarks || "").replace(/\n/g, " ")}"`
    ]);
    
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `History_${materialName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page active" id="page-material-history">
      <div className="card">
        <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn-sm" onClick={onBack}>
              <ArrowLeft size={16} /> Kembali
            </button>
            <span className="card-title">History: <b>{materialName}</b></span>
          </div>
          <button className="btn btn-sm" onClick={handleExportCsv}>
            <Download size={14} style={{ marginRight: 6 }} /> Export CSV
          </button>
        </div>
        
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <SortableHeader label="Tipe" sortKey="transactionType" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nota No." sortKey="notaNo" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="WH" sortKey="whGci" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tanggal" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Source/Dest" sortKey="sourceDestination" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Kode" sortKey="materialCode" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tagging" sortKey="taggingType" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Haspel/Drum" sortKey="drumNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Ket." sortKey="remarks" currentSort={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td><span className={`badge ${row.transactionType?.includes("INBOUND") || row.transactionType === "RETURN IN" ? "badge-inbound" : "badge-outbound"}`}>{row.transactionType}</span></td>
                  <td className="mono">{row.notaNo}</td>
                  <td style={{ color: "var(--blue)" }}>{row.whGci}</td>
                  <td>{row.date?.split(" ")[0]?.split("T")[0]}</td>
                  <td>{row.sourceDestination || "-"}</td>
                  <td className="mono">{row.materialCode}</td>
                  <td className="numeric"><b>{formatNumber(row.qty)}</b></td>
                  <td>{row.unit}</td>
                  <td><span className="badge" style={{ background: row.taggingType === "LEFTOVERS" ? "var(--orange)" : "var(--blue)", color: "white" }}>{row.taggingType}</span></td>
                  <td style={{ fontSize: 12, color: "var(--blue)" }}>{row.drumNumber || row.tagId || "-"}</td>
                  <td style={{ fontSize: 11 }}>{row.remarks || "-"}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada history untuk material ini.
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
