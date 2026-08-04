import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";
import { SortableHeader } from "./SortableHeader";
import { useSortableData } from "../hooks/useSortableData";

interface DrumSummaryProps {
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  onDrumClick: (drumId: string) => void;
}

interface DrumSummaryRow {
  id: string;
  drumNumber: string;
  materialName: string;
  totalIn: number;
  totalOut: number;
  balance: number;
}

export function DrumSummary({ logRows, leftoverRows, onDrumClick }: DrumSummaryProps) {
  const [search, setSearch] = useState("");

  const summaryData = useMemo(() => {
    const map: Record<string, DrumSummaryRow> = {};
    const allRows = [...logRows, ...leftoverRows];

    for (const row of allRows) {
      const drumId = row.drumNumber || (row.taggingType === "LEFTOVERS" ? row.tagId : null);
      if (!drumId) continue;

      const type = (row.transactionType || "").toUpperCase();
      let inQty = 0;
      let outQty = 0;

      if (type.includes(" IN") || type === "INBOUND") {
        inQty = Number(row.qty) || 0;
      } else if (type.includes(" OUT") || type === "OUTBOUND") {
        outQty = Number(row.qty) || 0;
      }

      if (!map[drumId]) {
        map[drumId] = {
          id: drumId,
          drumNumber: drumId,
          materialName: row.materialName || "-",
          totalIn: 0,
          totalOut: 0,
          balance: 0,
        };
      }

      map[drumId].totalIn += inQty;
      map[drumId].totalOut += outQty;
      map[drumId].balance = map[drumId].totalIn - map[drumId].totalOut;
    }

    return Object.values(map);
  }, [logRows, leftoverRows]);

  const filteredData = useMemo(() => {
    if (!search) return summaryData;
    const lowerSearch = search.toLowerCase();
    return summaryData.filter(
      (r) =>
        r.drumNumber.toLowerCase().includes(lowerSearch) ||
        r.materialName.toLowerCase().includes(lowerSearch)
    );
  }, [summaryData, search]);

  const { items: sortedRows, requestSort, sortConfig } = useSortableData(filteredData);

  const handleExportCsv = () => {
    const headers = ["Haspel/Drum", "Material", "Total In (Meter)", "Total Out (Meter)", "Balance (Meter)"];
    const rows = sortedRows.map((r) => [
      `"${r.drumNumber}"`,
      `"${r.materialName}"`,
      `"${r.totalIn}"`,
      `"${r.totalOut}"`,
      `"${r.balance}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Summary_Haspel.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Summary Haspel / Drum</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="search-box hide-print" style={{ width: 300 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari nomor haspel atau material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleExportCsv} title="Download CSV">
            <Download size={18} />
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Haspel/Drum" sortKey="drumNumber" currentSort={sortConfig} requestSort={requestSort} />
              <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
              <SortableHeader label="Total In" sortKey="totalIn" currentSort={sortConfig} requestSort={requestSort} align="right" />
              <SortableHeader label="Total Out" sortKey="totalOut" currentSort={sortConfig} requestSort={requestSort} align="right" />
              <SortableHeader label="Balance" sortKey="balance" currentSort={sortConfig} requestSort={requestSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id}>
                <td style={{ color: "var(--blue)" }}>
                  <span
                    onClick={() => onDrumClick(row.drumNumber)}
                    style={{ cursor: "pointer", textDecoration: "underline", fontWeight: 500 }}
                  >
                    {row.drumNumber}
                  </span>
                </td>
                <td>{row.materialName}</td>
                <td className="numeric" style={{ color: "var(--green)", fontWeight: 500 }}>{formatNumber(row.totalIn)}</td>
                <td className="numeric" style={{ color: "var(--orange)", fontWeight: 500 }}>{formatNumber(row.totalOut)}</td>
                <td className="numeric">
                  <b style={{ color: row.balance < 0 ? "var(--red)" : row.balance === 0 ? "var(--text3)" : "inherit" }}>
                    {formatNumber(row.balance)}
                  </b>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                  Tidak ada data haspel yang ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
