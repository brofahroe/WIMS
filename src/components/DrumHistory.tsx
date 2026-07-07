import { ArrowLeft, Download } from "lucide-react";
import { useMemo } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";

interface DrumHistoryProps {
  drumNumber: string;
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  onBack: () => void;
}

export function DrumHistory({ drumNumber, logRows, leftoverRows, onBack }: DrumHistoryProps) {
  const allRows = useMemo(() => {
    return [...logRows, ...leftoverRows]
      .filter(
        (r) =>
          r.drumNumber === drumNumber ||
          (r.taggingType === "LEFTOVERS" && r.tagId === drumNumber)
      )
      .sort((a, b) => {
        // Sort by date ascending to get chronological order
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });
  }, [drumNumber, logRows, leftoverRows]);

  const { items: sortedRows, requestSort, sortConfig } = useSortableData(allRows);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let unit = "";

    for (const row of allRows) {
      if (row.unit && !unit) unit = row.unit;
      const qty = Number(row.qty) || 0;
      
      const type = (row.transactionType || "").toUpperCase();
      if (type.includes("INBOUND") || type === "RETURN IN") {
        totalIn += qty;
      } else if (type.includes("OUTBOUND") || type === "TRANSFER OUT" || type === "BORROW OUT") {
        totalOut += qty;
      }
    }
    
    return {
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
      unit
    };
  }, [allRows]);

  const handleExportCsv = () => {
    const headers = [
      "Type",
      "Nota No",
      "WH",
      "Date",
      "Source/Dest",
      "Site ID",
      "Material Name",
      "Qty",
      "Unit",
      "Remarks"
    ];
    
    const csvRows = sortedRows.map((row) => [
      `"${row.transactionType || ""}"`,
      `"${row.notaNo || ""}"`,
      `"${row.whGci || ""}"`,
      `"${row.date?.split(" ")[0]?.split("T")[0] || ""}"`,
      `"${row.sourceDestination || ""}"`,
      `"${row.siteId || row.siteName || ""}"`,
      `"${row.materialName || ""}"`,
      `"${row.qty || 0}"`,
      `"${row.unit || ""}"`,
      `"${(row.remarks || "").replace(/\n/g, " ")}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `History_Haspel_${drumNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <ArrowLeft size={14} /> KEMBALI
              </button>
              <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "16px" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500, textTransform: "uppercase", fontSize: "12px", letterSpacing: "0.05em" }}>HISTORY HASPEL:</span>
                <span style={{ color: "var(--primary)" }}>{drumNumber}</span>
              </h2>
            </div>
            
            <div style={{ display: "flex", gap: "24px", marginTop: "12px", padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Total In (Masuk)</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--green)" }}>{formatNumber(summary.totalIn)} <span style={{ fontSize: "12px", fontWeight: 500 }}>{summary.unit}</span></div>
              </div>
              <div style={{ width: "1px", background: "var(--border)" }}></div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Total Out (Keluar)</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--orange)" }}>{formatNumber(summary.totalOut)} <span style={{ fontSize: "12px", fontWeight: 500 }}>{summary.unit}</span></div>
              </div>
              <div style={{ width: "1px", background: "var(--border)" }}></div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", fontWeight: 600 }}>Balance (Sisa)</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: summary.balance < 0 ? "var(--red)" : "var(--primary)" }}>{formatNumber(summary.balance)} <span style={{ fontSize: "12px", fontWeight: 500 }}>{summary.unit}</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-secondary" onClick={handleExportCsv} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <Download size={14} /> EXPORT CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card-body" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Tipe" sortKey="transactionType" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nota No." sortKey="notaNo" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tanggal" sortKey="date" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site ID / Destinasi" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Ket." sortKey="remarks" currentSort={sortConfig} requestSort={requestSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className={`badge ${row.transactionType?.includes("INBOUND") || row.transactionType === "RETURN IN" ? "badge-inbound" : "badge-outbound"}`}>
                      {row.transactionType}
                    </span>
                  </td>
                  <td className="mono">{row.notaNo}</td>
                  <td>{row.date?.split(" ")[0]?.split("T")[0]}</td>
                  <td>
                    {row.siteId && row.siteId !== "-" ? (
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--primary)" }}>{row.siteId}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{row.siteName}</div>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>{row.sourceDestination || "-"}</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{row.materialName}</td>
                  <td className="numeric"><b>{formatNumber(row.qty)}</b></td>
                  <td>{row.unit}</td>
                  <td style={{ fontSize: 11 }}>{row.remarks || "-"}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada history untuk haspel ini.
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
