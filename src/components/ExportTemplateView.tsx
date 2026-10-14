import React, { useMemo, useState } from "react";
import {
  Download,
  FileDown,
  Search,
  Calendar,
  Filter,
  Warehouse as WarehouseIcon,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import type { MaterialItem, SiteItem, TransactionRecord, WarehouseOption } from "../types";
import { EXPORT_TEMPLATE_COLUMNS } from "../types";
import {
  exportTemplateRowsToCsv,
  exportTemplateRowsToExcel,
  transformToExportTemplateRow,
} from "../lib/exportTemplate";
import { formatNumber, normalizeText } from "../lib/wims";

interface ExportTemplateViewProps {
  logRows: TransactionRecord[];
  materials: MaterialItem[];
  sites: SiteItem[];
  warehouses: WarehouseOption[];
  currentWarehouseFilter?: string;
}

export function ExportTemplateView({
  logRows,
  materials,
  sites,
  warehouses,
  currentWarehouseFilter = "ALL",
}: ExportTemplateViewProps) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(currentWarehouseFilter);
  const [selectedTxType, setSelectedTxType] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Quick date filters
  const setFilterToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setDateFrom(today);
    setDateTo(today);
    setCurrentPage(1);
  };

  const setFilterThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    setDateFrom(firstDay);
    setDateTo(lastDay);
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // Convert all logRows to Template Rows with site and material data resolved
  const allTemplateRows = useMemo(() => {
    return logRows.map((row) => transformToExportTemplateRow(row, materials, sites));
  }, [logRows, materials, sites]);

  // Filter rows based on user criteria
  const filteredRows = useMemo(() => {
    const query = normalizeText(searchQuery).toLowerCase();

    return allTemplateRows.filter((row) => {
      // Warehouse filter
      if (selectedWarehouse !== "ALL") {
        const matchesWarehouse =
          normalizeText(row.gudangAsal) === normalizeText(selectedWarehouse) ||
          normalizeText(row.gudangTujuan) === normalizeText(selectedWarehouse);
        if (!matchesWarehouse) return false;
      }

      // Transaction Type filter
      if (selectedTxType !== "ALL") {
        if (normalizeText(row.transactionType) !== normalizeText(selectedTxType)) {
          return false;
        }
      }

      // Date Range filter
      if (dateFrom && row.date && row.date < dateFrom) return false;
      if (dateTo && row.date && row.date > dateTo) return false;

      // Text Search
      if (query) {
        const rowHaystack = [
          row.transactionType,
          row.date,
          row.gudangAsal,
          row.gudangTujuan,
          row.cluster,
          row.sumberMaterial,
          row.noTransaksi,
          row.noDo,
          row.noDn,
          row.namaDriver,
          row.noHpDriver,
          row.kodeMaterial,
          row.namaMaterial,
          row.kondisi,
        ]
          .join(" ")
          .toLowerCase();

        if (!rowHaystack.includes(query)) return false;
      }

      return true;
    });
  }, [allTemplateRows, selectedWarehouse, selectedTxType, dateFrom, dateTo, searchQuery]);

  // Summary statistics
  const totalQty = useMemo(() => {
    return filteredRows.reduce((acc, row) => acc + (Number(row.qty) || 0), 0);
  }, [filteredRows]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    if (pageSize >= 999999) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const handleExportExcel = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const whSuffix = selectedWarehouse !== "ALL" ? `_${selectedWarehouse}` : "";
    exportTemplateRowsToExcel(filteredRows, `WIMS_Export_Template${whSuffix}_${dateStr}.xlsx`);
  };

  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const whSuffix = selectedWarehouse !== "ALL" ? `_${selectedWarehouse}` : "";
    exportTemplateRowsToCsv(filteredRows, `WIMS_Export_Template${whSuffix}_${dateStr}.csv`);
  };

  const getTypeBadgeClass = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes("INBOUND")) return "badge badge-inbound";
    if (t.includes("OUTBOUND")) return "badge badge-outbound";
    if (t.includes("TRANSFER")) return "badge badge-transfer";
    if (t.includes("BORROW")) return "badge badge-borrow";
    return "badge";
  };

  return (
    <div className="page active" id="page-export-template">
      {/* Header Banner */}
      <div
        className="card"
        style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  background: "var(--blue)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Layers size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Export Template Transaksi (15 Kolom)</h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>
              Ekspor transaksi WIMS dengan template terstandarisasi:{" "}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                Tipe Transaksi, Tanggal, Gudang Asal, Gudang Tujuan, Cluster, Sumber Material, No Transaksi / Group ID, No DO, No DN, Nama Driver, No HP Driver, Kode Material, Nama Material, Qty, Kondisi
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportExcel}
              disabled={filteredRows.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Download size={16} /> Export Excel (.xlsx)
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleExportCsv}
              disabled={filteredRows.length === 0}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <FileDown size={16} /> Export CSV (.csv)
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "flex-end" }}>
          {/* Warehouse Filter */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>
              <WarehouseIcon size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
              Gudang
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => {
                setSelectedWarehouse(e.target.value);
                setCurrentPage(1);
              }}
              className="form-control"
              style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Gudang</option>
              {warehouses
                .filter((w) => w.whGci)
                .map((w) => (
                  <option key={w.whGci} value={w.whGci!}>
                    {w.whGci}
                  </option>
                ))}
            </select>
          </div>

          {/* Transaction Type Filter */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>
              <Filter size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
              Tipe Transaksi
            </label>
            <select
              value={selectedTxType}
              onChange={(e) => {
                setSelectedTxType(e.target.value);
                setCurrentPage(1);
              }}
              className="form-control"
              style={{ width: "100%", padding: "8px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Tipe Transaksi</option>
              <option value="INBOUND">INBOUND</option>
              <option value="OUTBOUND">OUTBOUND</option>
              <option value="TRANSFER IN">TRANSFER IN</option>
              <option value="TRANSFER OUT">TRANSFER OUT</option>
              <option value="BORROW IN">BORROW IN</option>
              <option value="BORROW OUT">BORROW OUT</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>
              <Calendar size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
              Tanggal Dari
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>

          {/* Date To */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>
              <Calendar size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
              Tanggal Sampai
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>

          {/* Search Box */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--text2)" }}>
              <Search size={13} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
              Pencarian Cepat
            </label>
            <input
              type="text"
              placeholder="Cari no nota, kode/nama material, site, cluster, driver, no DO/DN..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            />
          </div>
        </div>

        {/* Date presets & Status badge */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text2)" }}>Preset Periode:</span>
            <button type="button" className="btn btn-sm" onClick={setFilterToday}>
              Hari Ini
            </button>
            <button type="button" className="btn btn-sm" onClick={setFilterThisMonth}>
              Bulan Ini
            </button>
            <button type="button" className="btn btn-sm" onClick={clearDateFilter}>
              Semua Periode
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
            <div>
              <b>Total Data:</b> <span style={{ color: "var(--blue)", fontWeight: 700 }}>{formatNumber(filteredRows.length)}</span> baris
            </div>
            <div>
              <b>Total Qty:</b> <span style={{ color: "var(--green)", fontWeight: 700 }}>{formatNumber(totalQty)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Preview Card */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="card-title">Preview Data Template ({filteredRows.length} baris)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span>Tampilkan per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={999999}>Semua</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto", maxHeight: "600px" }}>
          <table className="table" style={{ fontSize: 12, width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--card-bg, #ffffff)", borderBottom: "2px solid var(--border)" }}>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>#</th>
                {EXPORT_TEMPLATE_COLUMNS.map((col) => (
                  <th key={col} style={{ whiteSpace: "nowrap", padding: "8px 10px", textAlign: col === "Qty" ? "right" : "left" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={EXPORT_TEMPLATE_COLUMNS.length + 1} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text2)" }}>
                    Tidak ada transaksi yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => {
                  const rowNumber = (currentPage - 1) * (pageSize >= 999999 ? 0 : pageSize) + idx + 1;
                  return (
                    <tr key={`${r.noTransaksi}-${r.kodeMaterial}-${idx}`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ textAlign: "center", color: "var(--text3)" }}>{rowNumber}</td>
                      <td>
                        <span className={getTypeBadgeClass(r.transactionType)}>{r.transactionType || "-"}</span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.date || "-"}</td>
                      <td style={{ fontWeight: 500 }}>{r.gudangAsal || "-"}</td>
                      <td style={{ fontWeight: 500 }}>{r.gudangTujuan || "-"}</td>
                      <td>{r.cluster || "-"}</td>
                      <td>{r.sumberMaterial || "-"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{r.noTransaksi || "-"}</td>
                      <td>{r.noDo || "-"}</td>
                      <td>{r.noDn || "-"}</td>
                      <td>{r.namaDriver || "-"}</td>
                      <td style={{ fontFamily: "monospace" }}>{r.noHpDriver || "-"}</td>
                      <td style={{ fontFamily: "monospace" }}>{r.kodeMaterial || "-"}</td>
                      <td style={{ fontWeight: 500 }}>{r.namaMaterial || "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "var(--blue)" }}>
                        {formatNumber(r.qty)}
                      </td>
                      <td>{r.kondisi || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pageSize < 999999 && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>
              Menampilkan halaman <b>{currentPage}</b> dari <b>{totalPages}</b> (Total {formatNumber(filteredRows.length)} data)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 12, padding: "0 6px" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
