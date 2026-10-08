import React, { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  Calendar,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Table as TableIcon,
  Eye,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type {
  MasterData,
  SiteItem,
  SiteMonthlyAggregate,
  TransactionRecord,
} from "../types";
import {
  aggregateSiteMonthly,
  formatNumber,
  formatMonthIndonesian,
  formatMonthShort,
  getMonthKey,
  normalizeText,
} from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";
import { Modal } from "./ui/Modal";

interface SiteSummaryMonthlyProps {
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  master?: MasterData;
  sites?: SiteItem[];
  onMaterialClick?: (materialName: string) => void;
  onDrumClick?: (drumId: string) => void;
}

type ViewMode = "summary" | "detail" | "matrix" | "analytics";
type MatrixMetric = "both" | "outbound" | "inbound" | "net";

export function SiteSummaryMonthly({
  logRows,
  leftoverRows,
  master,
  sites = [],
  onMaterialClick,
  onDrumClick,
}: SiteSummaryMonthlyProps) {
  // Filters state
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = useState("ALL");
  const [activityFilter, setActivityFilter] = useState<"ALL" | "BOTH" | "INBOUND_ONLY" | "OUTBOUND_ONLY">("ALL");
  const [includeTransfers, setIncludeTransfers] = useState(false);
  
  // UI Tabs & Modes
  const [activeTab, setActiveTab] = useState<ViewMode>("summary");
  const [matrixMetric, setMatrixMetric] = useState<MatrixMetric>("both");
  
  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Accordion expanded row IDs
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modal for individual transactions
  const [txModalData, setTxModalData] = useState<SiteMonthlyAggregate | null>(null);

  // Combine rows
  const allRows = useMemo(() => [...logRows, ...leftoverRows], [logRows, leftoverRows]);

  // Compute baseline options (years, months, warehouses) from all rows
  const baseline = useMemo(() => {
    return aggregateSiteMonthly(allRows, { includeTransfers });
  }, [allRows, includeTransfers]);

  // Compute filtered aggregated data
  const aggregated = useMemo(() => {
    return aggregateSiteMonthly(allRows, {
      includeTransfers,
      warehouseFilter,
      yearFilter,
      monthFilter,
      activityFilter,
      searchQuery: query,
    });
  }, [allRows, includeTransfers, warehouseFilter, yearFilter, monthFilter, activityFilter, query]);

  // Sortable summary table
  const { items: sortedSummary, requestSort: requestSortSummary, sortConfig: sortConfigSummary } = useSortableData(
    aggregated.items,
    { key: "monthKey", direction: "descending" }
  );

  // Flattened material rows for "Detail Material" tab
  const flattenedMaterials = useMemo(() => {
    const list: Array<{
      id: string;
      siteId: string;
      siteName: string;
      monthKey: string;
      monthLabel: string;
      materialName: string;
      materialCode: string;
      unit: string;
      inboundQty: number;
      outboundQty: number;
      netQty: number;
      inboundTxCount: number;
      outboundTxCount: number;
      totalTxCount: number;
    }> = [];

    for (const item of aggregated.items) {
      for (const mat of item.materials) {
        list.push({
          id: `${item.id}___${mat.materialName}`,
          siteId: item.siteId,
          siteName: item.siteName,
          monthKey: item.monthKey,
          monthLabel: item.monthLabel,
          materialName: mat.materialName,
          materialCode: mat.materialCode,
          unit: mat.unit,
          inboundQty: mat.inboundQty,
          outboundQty: mat.outboundQty,
          netQty: mat.netQty,
          inboundTxCount: mat.inboundTxCount,
          outboundTxCount: mat.outboundTxCount,
          totalTxCount: mat.totalTxCount,
        });
      }
    }
    return list;
  }, [aggregated.items]);

  const { items: sortedMaterials, requestSort: requestSortMaterials, sortConfig: sortConfigMaterials } = useSortableData(
    flattenedMaterials,
    { key: "monthKey", direction: "descending" }
  );

  // Matrix / Pivot Data per Site x Month
  const matrixData = useMemo(() => {
    // Collect months that are present in the filtered view, sorted chronologically ascending
    const monthsInView = Array.from(new Set(aggregated.items.map((x) => x.monthKey))).sort();

    const siteMap = new Map<string, {
      siteId: string;
      siteName: string;
      months: Record<string, { inQty: number; outQty: number; netQty: number }>;
      totalIn: number;
      totalOut: number;
      totalNet: number;
    }>();

    for (const item of aggregated.items) {
      if (!siteMap.has(item.siteName)) {
        siteMap.set(item.siteName, {
          siteId: item.siteId,
          siteName: item.siteName,
          months: {},
          totalIn: 0,
          totalOut: 0,
          totalNet: 0,
        });
      }
      const s = siteMap.get(item.siteName)!;
      if (item.siteId !== "-" && s.siteId === "-") {
        s.siteId = item.siteId;
      }
      s.months[item.monthKey] = {
        inQty: item.inboundQty,
        outQty: item.outboundQty,
        netQty: item.netQty,
      };
      s.totalIn += item.inboundQty;
      s.totalOut += item.outboundQty;
      s.totalNet += item.netQty;
    }

    return {
      months: monthsInView,
      sites: Array.from(siteMap.values()).sort((a, b) => b.totalOut - a.totalOut),
    };
  }, [aggregated.items]);

  // Analytics Chart Data
  const monthlyChartData = useMemo(() => {
    const map = new Map<string, { monthKey: string; monthLabel: string; inbound: number; outbound: number; net: number }>();
    // Sort chronological ascending
    const sortedChronological = [...aggregated.items].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    for (const item of sortedChronological) {
      if (!map.has(item.monthKey)) {
        map.set(item.monthKey, {
          monthKey: item.monthKey,
          monthLabel: formatMonthShort(item.monthKey),
          inbound: 0,
          outbound: 0,
          net: 0,
        });
      }
      const m = map.get(item.monthKey)!;
      m.inbound += item.inboundQty;
      m.outbound += item.outboundQty;
      m.net += item.netQty;
    }

    return Array.from(map.values());
  }, [aggregated.items]);

  const topSitesOutbound = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of aggregated.items) {
      map.set(item.siteName, (map.get(item.siteName) || 0) + item.outboundQty);
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [aggregated.items]);

  const topSitesInbound = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of aggregated.items) {
      map.set(item.siteName, (map.get(item.siteName) || 0) + item.inboundQty);
    }
    return Array.from(map.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [aggregated.items]);

  // Pagination for summary table
  const totalPages = Math.ceil(sortedSummary.length / pageSize) || 1;
  const paginatedSummary = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedSummary.slice(start, start + pageSize);
  }, [sortedSummary, currentPage, pageSize]);

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetFilters = () => {
    setQuery("");
    setYearFilter("ALL");
    setMonthFilter("ALL");
    setWarehouseFilter("ALL");
    setActivityFilter("ALL");
    setIncludeTransfers(false);
    setCurrentPage(1);
  };

  // Export CSV
  const handleExportCsv = () => {
    if (activeTab === "detail") {
      const headers = ["Site ID", "Site Name", "Bulan", "Nama Material", "Kode Material", "Unit", "Inbound Qty", "Outbound Qty", "Net Qty", "Tx Inbound", "Tx Outbound"];
      const rows = sortedMaterials.map((r) => [
        `"${r.siteId}"`,
        `"${r.siteName}"`,
        `"${r.monthKey}"`,
        `"${r.materialName}"`,
        `"${r.materialCode}"`,
        `"${r.unit}"`,
        `"${r.inboundQty}"`,
        `"${r.outboundQty}"`,
        `"${r.netQty}"`,
        `"${r.inboundTxCount}"`,
        `"${r.outboundTxCount}"`,
      ]);
      downloadCsv("Summary_Material_Site_Bulanan.csv", headers, rows);
    } else if (activeTab === "matrix") {
      const headers = ["Site ID", "Site Name", ...matrixData.months.map((m) => formatMonthIndonesian(m)), "Total Inbound", "Total Outbound", "Grand Net"];
      const rows = matrixData.sites.map((s) => [
        `"${s.siteId}"`,
        `"${s.siteName}"`,
        ...matrixData.months.map((m) => {
          const val = s.months[m];
          if (!val) return '"-"';
          if (matrixMetric === "outbound") return `"${val.outQty}"`;
          if (matrixMetric === "inbound") return `"${val.inQty}"`;
          if (matrixMetric === "net") return `"${val.netQty}"`;
          return `"Out: ${val.outQty} | In: ${val.inQty}"`;
        }),
        `"${s.totalIn}"`,
        `"${s.totalOut}"`,
        `"${s.totalNet}"`,
      ]);
      downloadCsv("Matriks_Site_Bulanan.csv", headers, rows);
    } else {
      const headers = ["Site ID", "Site Name", "Bulan", "Gudang", "Inbound Qty", "Outbound Qty", "Net Qty", "Tx Inbound", "Tx Outbound", "Total Tx"];
      const rows = sortedSummary.map((r) => [
        `"${r.siteId}"`,
        `"${r.siteName}"`,
        `"${r.monthKey}"`,
        `"${r.warehouses.join(", ") || "-"}"`,
        `"${r.inboundQty}"`,
        `"${r.outboundQty}"`,
        `"${r.netQty}"`,
        `"${r.inboundTxCount}"`,
        `"${r.outboundTxCount}"`,
        `"${r.totalTxCount}"`,
      ]);
      downloadCsv("Summary_Outbound_Inbound_Site_Bulanan.csv", headers, rows);
    }
  };

  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Excel (.xlsx) multi-sheet
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary Site & Bulan
    const s1Headers = ["No", "Site ID", "Nama Site", "Periode Bulan", "Gudang", "Total Inbound Qty", "Total Outbound Qty", "Net Qty (Out - In)", "Tx Inbound", "Tx Outbound", "Total Tx"];
    const s1Rows = sortedSummary.map((r, idx) => [
      idx + 1,
      r.siteId,
      r.siteName,
      r.monthKey,
      r.warehouses.join(", ") || "-",
      r.inboundQty,
      r.outboundQty,
      r.netQty,
      r.inboundTxCount,
      r.outboundTxCount,
      r.totalTxCount,
    ]);
    const ws1 = XLSX.utils.aoa_to_sheet([s1Headers, ...s1Rows]);
    XLSX.utils.book_append_sheet(wb, ws1, "Summary Site & Bulan");

    // Sheet 2: Detail Material per Site & Bulan
    const s2Headers = ["No", "Site ID", "Nama Site", "Periode Bulan", "Nama Material", "Kode Material", "Unit", "Inbound Qty", "Outbound Qty", "Net Qty", "Tx Inbound", "Tx Outbound", "Total Tx"];
    const s2Rows = sortedMaterials.map((r, idx) => [
      idx + 1,
      r.siteId,
      r.siteName,
      r.monthKey,
      r.materialName,
      r.materialCode,
      r.unit,
      r.inboundQty,
      r.outboundQty,
      r.netQty,
      r.inboundTxCount,
      r.outboundTxCount,
      r.totalTxCount,
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([s2Headers, ...s2Rows]);
    XLSX.utils.book_append_sheet(wb, ws2, "Detail Material");

    // Sheet 3: Matriks Bulanan
    const s3Headers = ["Site ID", "Nama Site", ...matrixData.months.map((m) => formatMonthIndonesian(m)), "Total Inbound", "Total Outbound", "Grand Net"];
    const s3Rows = matrixData.sites.map((s) => [
      s.siteId,
      s.siteName,
      ...matrixData.months.map((m) => {
        const val = s.months[m];
        if (!val) return 0;
        return val.outQty;
      }),
      s.totalIn,
      s.totalOut,
      s.totalNet,
    ]);
    const ws3 = XLSX.utils.aoa_to_sheet([s3Headers, ...s3Rows]);
    XLSX.utils.book_append_sheet(wb, ws3, "Matriks Outbound");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `WIMS_Summary_Site_Bulanan_${dateStr}.xlsx`);
  };

  return (
    <div className="page active" id="page-site-summary">
      {/* Top Banner & Control Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={20} style={{ color: "var(--blue)" }} />
              <h2 className="card-title" style={{ fontSize: 16, margin: 0 }}>
                Summary Outbound & Inbound Per Site (Bulanan)
              </h2>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text3)" }}>
              Rekapitulasi pergerakan barang masuk & keluar per site name dan periode bulan
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              title="Export Tab Aktif ke CSV"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleExportExcel}
              title="Export Buku Kerja Excel Lengkap"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <FileSpreadsheet size={14} /> Export Excel (.xlsx)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
              title="Reset Semua Filter"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} /> Reset Filter
            </button>
          </div>
        </div>

        {/* KPI Strip Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, padding: "16px 16px 8px 16px" }}>
          <div className="kpi-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              <span>Total Site Aktif</span>
              <MapPin size={16} style={{ color: "var(--blue)" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>
              {formatNumber(aggregated.totals.uniqueSites)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Site dengan pergerakan</div>
          </div>

          <div className="kpi-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              <span>Total Outbound</span>
              <ArrowUpFromLine size={16} style={{ color: "var(--orange)" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--orange)" }}>
              {formatNumber(aggregated.totals.outboundQty)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Barang keluar ke site</div>
          </div>

          <div className="kpi-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              <span>Total Inbound (Return)</span>
              <ArrowDownToLine size={16} style={{ color: "var(--green)" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--green)" }}>
              {formatNumber(aggregated.totals.inboundQty)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Barang kembali dari site</div>
          </div>

          <div className="kpi-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              <span>Net di Site (Out - In)</span>
              <Boxes size={16} style={{ color: "var(--blue)" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: aggregated.totals.netQty >= 0 ? "var(--blue)" : "var(--red)" }}>
              {formatNumber(aggregated.totals.netQty)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Akumulasi terpasang/di site</div>
          </div>

          <div className="kpi-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px 14px", borderRadius: "var(--radius)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text3)", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              <span>Total Transaksi</span>
              <Calendar size={16} style={{ color: "var(--purple)" }} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>
              {formatNumber(aggregated.totals.totalTxCount)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Nota / baris transaksi</div>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Live Search */}
          <div className="search-box" style={{ flex: "1 1 220px", minWidth: 200 }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Cari Site Name, Site ID, atau Material..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Tahun Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Tahun:</span>
            <select
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Tahun</option>
              {baseline.allYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Bulan Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Bulan:</span>
            <select
              value={monthFilter}
              onChange={(e) => {
                setMonthFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Bulan</option>
              {baseline.allMonths
                .filter((m) => yearFilter === "ALL" || m.startsWith(yearFilter))
                .map((m) => (
                  <option key={m} value={m}>
                    {m} - {formatMonthIndonesian(m)}
                  </option>
                ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Gudang:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => {
                setWarehouseFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Gudang</option>
              {baseline.allWarehouses.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Aktivitas Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>Aktivitas:</span>
            <select
              value={activityFilter}
              onChange={(e) => {
                setActivityFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              style={{ padding: "6px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", color: "var(--text)" }}
            >
              <option value="ALL">Semua Transaksi</option>
              <option value="BOTH">Ada Inbound & Outbound</option>
              <option value="OUTBOUND_ONLY">Hanya Outbound</option>
              <option value="INBOUND_ONLY">Hanya Inbound</option>
            </select>
          </div>

          {/* Checkbox include transfers */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "var(--text2)", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={includeTransfers}
              onChange={(e) => {
                setIncludeTransfers(e.target.checked);
                setCurrentPage(1);
              }}
            />
            <span>Termasuk Transfer & Pinjam</span>
          </label>
        </div>

        {/* View Mode Tabs */}
        <div style={{ display: "flex", borderTop: "1px solid var(--border)", background: "var(--bg)", padding: "0 16px" }}>
          <button
            type="button"
            className={`btn ${activeTab === "summary" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("summary")}
            style={{ borderRadius: 0, borderBottom: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}
          >
            <TableIcon size={14} />
            <span>Ringkasan Site & Bulan ({aggregated.items.length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === "detail" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("detail")}
            style={{ borderRadius: 0, borderBottom: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}
          >
            <Layers size={14} />
            <span>Detail Material ({flattenedMaterials.length})</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === "matrix" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("matrix")}
            style={{ borderRadius: 0, borderBottom: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}
          >
            <FileSpreadsheet size={14} />
            <span>Matriks Pivot Bulanan</span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === "analytics" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("analytics")}
            style={{ borderRadius: 0, borderBottom: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px" }}
          >
            <BarChart3 size={14} />
            <span>Grafik & Analisis</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RINGKASAN SITE & BULAN */}
      {activeTab === "summary" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="card-title" style={{ fontSize: 13 }}>
              Daftar Ringkasan per Site & Bulan ({sortedSummary.length} Baris Data)
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: "4px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
              >
                <option value={15}>15 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
                <option value={100}>100 baris</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>#</th>
                  <th style={{ width: 40, textAlign: "center" }}>Detail</th>
                  <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfigSummary} requestSort={requestSortSummary} />
                  <SortableHeader label="Nama Site" sortKey="siteName" currentSort={sortConfigSummary} requestSort={requestSortSummary} />
                  <SortableHeader label="Periode Bulan" sortKey="monthKey" currentSort={sortConfigSummary} requestSort={requestSortSummary} />
                  <th>Gudang</th>
                  <SortableHeader label="Total Inbound (Masuk)" sortKey="inboundQty" currentSort={sortConfigSummary} requestSort={requestSortSummary} align="right" />
                  <SortableHeader label="Total Outbound (Keluar)" sortKey="outboundQty" currentSort={sortConfigSummary} requestSort={requestSortSummary} align="right" />
                  <SortableHeader label="Net di Site (Out - In)" sortKey="netQty" currentSort={sortConfigSummary} requestSort={requestSortSummary} align="right" />
                  <SortableHeader label="Total Transaksi" sortKey="totalTxCount" currentSort={sortConfigSummary} requestSort={requestSortSummary} align="center" />
                  <th style={{ textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSummary.map((row, idx) => {
                  const isExpanded = expandedRows.has(row.id);
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <React.Fragment key={row.id}>
                      <tr style={{ background: isExpanded ? "var(--soft)" : undefined }}>
                        <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{rowNumber}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => toggleRowExpand(row.id)}
                            title={isExpanded ? "Sembunyikan Material" : "Lihat Rincian Material"}
                            style={{ padding: "2px 6px", background: "transparent" }}
                          >
                            {isExpanded ? <ChevronDown size={15} style={{ color: "var(--orange)" }} /> : <ChevronRight size={15} />}
                          </button>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--text2)", fontFamily: "monospace" }}>
                          {row.siteId}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>{row.siteName}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)" }}>
                            {row.materials.length} macam material
                          </div>
                        </td>
                        <td>
                          <span style={{ display: "inline-block", padding: "2px 8px", background: "var(--purple-light)", color: "var(--purple)", borderRadius: "var(--radius)", fontSize: 11, fontWeight: 600 }}>
                            {row.monthLabel}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {row.warehouses.length > 0 ? (
                              row.warehouses.map((w) => (
                                <span key={w} style={{ fontSize: 11, background: "var(--soft-line)", padding: "1px 6px", borderRadius: "var(--radius)" }}>
                                  {w}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "var(--text3)" }}>-</span>
                            )}
                          </div>
                        </td>
                        <td className="numeric" style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: row.inboundQty > 0 ? "var(--green)" : "var(--text3)" }}>
                            {formatNumber(row.inboundQty)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>
                            {row.inboundTxCount} tx
                          </div>
                        </td>
                        <td className="numeric" style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: row.outboundQty > 0 ? "var(--orange)" : "var(--text3)" }}>
                            {formatNumber(row.outboundQty)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text3)" }}>
                            {row.outboundTxCount} tx
                          </div>
                        </td>
                        <td className="numeric" style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              color: row.netQty > 0 ? "var(--blue)" : row.netQty < 0 ? "var(--red)" : "var(--text3)",
                            }}
                          >
                            {row.netQty > 0 ? `+${formatNumber(row.netQty)}` : formatNumber(row.netQty)}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: "var(--surface)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: "var(--radius)" }}>
                            {row.totalTxCount}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setTxModalData(row)}
                            title="Buka History Transaksi Nota"
                            style={{ padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}
                          >
                            <Eye size={12} /> Nota
                          </button>
                        </td>
                      </tr>

                      {/* Nested Material Detail Accordion */}
                      {isExpanded && (
                        <tr style={{ background: "var(--soft)" }}>
                          <td colSpan={11} style={{ padding: "8px 16px 16px 56px" }}>
                            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                                  Rincian Material untuk {row.siteName} ({row.monthLabel})
                                </span>
                                <span style={{ fontSize: 11, color: "var(--text3)" }}>
                                  Total {row.materials.length} material
                                </span>
                              </div>

                              <table className="table" style={{ fontSize: 12, margin: 0 }}>
                                <thead>
                                  <tr style={{ background: "var(--bg)" }}>
                                    <th style={{ width: 30 }}>#</th>
                                    <th>Kode Material</th>
                                    <th>Nama Material</th>
                                    <th>Satuan</th>
                                    <th style={{ textAlign: "right", color: "var(--green)" }}>Inbound (Masuk)</th>
                                    <th style={{ textAlign: "right", color: "var(--orange)" }}>Outbound (Keluar)</th>
                                    <th style={{ textAlign: "right" }}>Net di Site</th>
                                    <th style={{ textAlign: "center" }}>Tx</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.materials.map((mat, mIdx) => (
                                    <tr key={`${mat.materialName}-${mIdx}`}>
                                      <td style={{ color: "var(--text3)" }}>{mIdx + 1}</td>
                                      <td style={{ fontFamily: "monospace", color: "var(--text2)" }}>
                                        {mat.materialCode || "-"}
                                      </td>
                                      <td style={{ fontWeight: 600 }}>
                                        {onMaterialClick ? (
                                          <span
                                            onClick={() => onMaterialClick(mat.materialName)}
                                            style={{ color: "var(--blue)", cursor: "pointer", textDecoration: "underline" }}
                                          >
                                            {mat.materialName}
                                          </span>
                                        ) : (
                                          mat.materialName
                                        )}
                                      </td>
                                      <td>{mat.unit}</td>
                                      <td style={{ textAlign: "right", fontWeight: 600, color: mat.inboundQty > 0 ? "var(--green)" : "var(--text3)" }}>
                                        {formatNumber(mat.inboundQty)}
                                      </td>
                                      <td style={{ textAlign: "right", fontWeight: 600, color: mat.outboundQty > 0 ? "var(--orange)" : "var(--text3)" }}>
                                        {formatNumber(mat.outboundQty)}
                                      </td>
                                      <td
                                        style={{
                                          textAlign: "right",
                                          fontWeight: 700,
                                          color: mat.netQty > 0 ? "var(--blue)" : mat.netQty < 0 ? "var(--red)" : "inherit",
                                        }}
                                      >
                                        {mat.netQty > 0 ? `+${formatNumber(mat.netQty)}` : formatNumber(mat.netQty)}
                                      </td>
                                      <td style={{ textAlign: "center", color: "var(--text3)" }}>
                                        {mat.totalTxCount}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {paginatedSummary.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "40px", color: "var(--text3)" }}>
                      Tidak ada data summary yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text3)" }}>
                Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, sortedSummary.length)} dari {sortedSummary.length} data
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </button>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", fontSize: 12, fontWeight: 600 }}>
                  Halaman {currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DETAIL PER MATERIAL */}
      {activeTab === "detail" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="card-title" style={{ fontSize: 13 }}>
              Daftar Pergerakan per Material & Site ({sortedMaterials.length} Baris Data)
            </span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center" }}>#</th>
                  <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} />
                  <SortableHeader label="Nama Site" sortKey="siteName" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} />
                  <SortableHeader label="Bulan" sortKey="monthKey" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} />
                  <SortableHeader label="Nama Material" sortKey="materialName" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} />
                  <SortableHeader label="Kode" sortKey="materialCode" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} />
                  <th>Unit</th>
                  <SortableHeader label="Inbound Qty" sortKey="inboundQty" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} align="right" />
                  <SortableHeader label="Outbound Qty" sortKey="outboundQty" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} align="right" />
                  <SortableHeader label="Net di Site" sortKey="netQty" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} align="right" />
                  <SortableHeader label="Tx" sortKey="totalTxCount" currentSort={sortConfigMaterials} requestSort={requestSortMaterials} align="center" />
                </tr>
              </thead>
              <tbody>
                {sortedMaterials.slice(0, 500).map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "var(--text3)", fontSize: 12 }}>{idx + 1}</td>
                    <td style={{ fontFamily: "monospace", color: "var(--text2)" }}>{row.siteId}</td>
                    <td style={{ fontWeight: 600 }}>{row.siteName}</td>
                    <td>
                      <span style={{ fontSize: 11, background: "var(--purple-light)", color: "var(--purple)", padding: "2px 6px", borderRadius: "var(--radius)", fontWeight: 600 }}>
                        {row.monthKey}
                      </span>
                    </td>
                    <td>
                      {onMaterialClick ? (
                        <span
                          onClick={() => onMaterialClick(row.materialName)}
                          style={{ color: "var(--blue)", cursor: "pointer", textDecoration: "underline", fontWeight: 500 }}
                        >
                          {row.materialName}
                        </span>
                      ) : (
                        row.materialName
                      )}
                    </td>
                    <td style={{ fontFamily: "monospace", color: "var(--text3)" }}>{row.materialCode}</td>
                    <td>{row.unit}</td>
                    <td className="numeric" style={{ textAlign: "right", color: row.inboundQty > 0 ? "var(--green)" : "var(--text3)", fontWeight: 600 }}>
                      {formatNumber(row.inboundQty)}
                    </td>
                    <td className="numeric" style={{ textAlign: "right", color: row.outboundQty > 0 ? "var(--orange)" : "var(--text3)", fontWeight: 600 }}>
                      {formatNumber(row.outboundQty)}
                    </td>
                    <td
                      className="numeric"
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: row.netQty > 0 ? "var(--blue)" : row.netQty < 0 ? "var(--red)" : "inherit",
                      }}
                    >
                      {row.netQty > 0 ? `+${formatNumber(row.netQty)}` : formatNumber(row.netQty)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text3)" }}>{row.totalTxCount}</td>
                  </tr>
                ))}

                {sortedMaterials.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "40px", color: "var(--text3)" }}>
                      Tidak ada detail material yang ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedMaterials.length > 500 && (
            <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--text3)", textAlign: "center", borderTop: "1px solid var(--border)" }}>
              Menampilkan 500 baris pertama. Gunakan filter pencarian atau ekspor Excel untuk data lengkap.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MATRIKS BULANAN (PIVOT) */}
      {activeTab === "matrix" && (
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <span className="card-title" style={{ fontSize: 13 }}>
                Matriks Bulanan per Site ({matrixData.sites.length} Site, {matrixData.months.length} Periode Bulan)
              </span>
            </div>

            {/* Metric display selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "var(--text3)", fontWeight: 500 }}>Tampilkan Metrik:</span>
              <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setMatrixMetric("both")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: matrixMetric === "both" ? "var(--sidebar-strong)" : "var(--surface)",
                    color: matrixMetric === "both" ? "#ffffff" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Out & In
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMetric("outbound")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: matrixMetric === "outbound" ? "var(--sidebar-strong)" : "var(--surface)",
                    color: matrixMetric === "outbound" ? "#ffffff" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Hanya Outbound
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMetric("inbound")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: matrixMetric === "inbound" ? "var(--sidebar-strong)" : "var(--surface)",
                    color: matrixMetric === "inbound" ? "#ffffff" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Hanya Inbound
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMetric("net")}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    background: matrixMetric === "net" ? "var(--sidebar-strong)" : "var(--surface)",
                    color: matrixMetric === "net" ? "#ffffff" : "var(--text)",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Net (Out - In)
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrap" style={{ maxHeight: 600, overflowX: "auto" }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: "center", position: "sticky", left: 0, zIndex: 2, background: "var(--surface)" }}>#</th>
                  <th style={{ position: "sticky", left: 40, zIndex: 2, background: "var(--surface)", minWidth: 200 }}>Nama Site</th>
                  {matrixData.months.map((m) => (
                    <th key={m} style={{ textAlign: "center", minWidth: matrixMetric === "both" ? 130 : 90 }}>
                      <div style={{ fontWeight: 700 }}>{formatMonthShort(m)}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: "normal" }}>{m}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: "right", minWidth: 100, background: "var(--bg)", fontWeight: 700 }}>Total Out</th>
                  <th style={{ textAlign: "right", minWidth: 100, background: "var(--bg)", fontWeight: 700 }}>Total In</th>
                  <th style={{ textAlign: "right", minWidth: 100, background: "var(--bg)", fontWeight: 700 }}>Grand Net</th>
                </tr>
              </thead>
              <tbody>
                {matrixData.sites.map((s, idx) => (
                  <tr key={s.siteName}>
                    <td style={{ textAlign: "center", color: "var(--text3)", position: "sticky", left: 0, background: "var(--surface)" }}>{idx + 1}</td>
                    <td style={{ position: "sticky", left: 40, background: "var(--surface)", fontWeight: 600 }}>
                      <div>{s.siteName}</div>
                      {s.siteId !== "-" && (
                        <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace" }}>{s.siteId}</div>
                      )}
                    </td>
                    {matrixData.months.map((m) => {
                      const cell = s.months[m];
                      if (!cell) {
                        return (
                          <td key={m} style={{ textAlign: "center", color: "var(--text3)" }}>
                            -
                          </td>
                        );
                      }

                      if (matrixMetric === "both") {
                        return (
                          <td key={m} style={{ textAlign: "center", padding: "4px 8px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ color: "var(--orange)", fontWeight: 600, fontSize: 11 }}>
                                Out: {formatNumber(cell.outQty)}
                              </span>
                              {cell.inQty > 0 && (
                                <span style={{ color: "var(--green)", fontWeight: 600, fontSize: 11 }}>
                                  In: {formatNumber(cell.inQty)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      }

                      if (matrixMetric === "outbound") {
                        return (
                          <td key={m} style={{ textAlign: "right", fontWeight: cell.outQty > 0 ? 600 : "normal", color: cell.outQty > 0 ? "var(--orange)" : "var(--text3)" }}>
                            {cell.outQty > 0 ? formatNumber(cell.outQty) : "-"}
                          </td>
                        );
                      }

                      if (matrixMetric === "inbound") {
                        return (
                          <td key={m} style={{ textAlign: "right", fontWeight: cell.inQty > 0 ? 600 : "normal", color: cell.inQty > 0 ? "var(--green)" : "var(--text3)" }}>
                            {cell.inQty > 0 ? formatNumber(cell.inQty) : "-"}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={m}
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            color: cell.netQty > 0 ? "var(--blue)" : cell.netQty < 0 ? "var(--red)" : "inherit",
                          }}
                        >
                          {cell.netQty > 0 ? `+${formatNumber(cell.netQty)}` : formatNumber(cell.netQty)}
                        </td>
                      );
                    })}
                    <td className="numeric" style={{ textAlign: "right", fontWeight: 700, color: "var(--orange)", background: "var(--bg)" }}>
                      {formatNumber(s.totalOut)}
                    </td>
                    <td className="numeric" style={{ textAlign: "right", fontWeight: 700, color: "var(--green)", background: "var(--bg)" }}>
                      {formatNumber(s.totalIn)}
                    </td>
                    <td className="numeric" style={{ textAlign: "right", fontWeight: 700, color: s.totalNet >= 0 ? "var(--blue)" : "var(--red)", background: "var(--bg)" }}>
                      {s.totalNet > 0 ? `+${formatNumber(s.totalNet)}` : formatNumber(s.totalNet)}
                    </td>
                  </tr>
                ))}

                {matrixData.sites.length === 0 && (
                  <tr>
                    <td colSpan={matrixData.months.length + 5} style={{ textAlign: "center", padding: "40px", color: "var(--text3)" }}>
                      Tidak ada data matriks bulanan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: GRAFIK & ANALISIS */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Monthly Trend Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Tren Pergerakan Bulanan (Outbound vs Inbound Qty)</span>
            </div>
            <div style={{ padding: 16 }}>
              {monthlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="outbound" name="Outbound (Keluar)" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="inbound" name="Inbound (Masuk)" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>
                  Tidak ada data untuk grafik.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16 }}>
            {/* Top Sites Outbound */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top 10 Site Berdasarkan Outbound Qty</span>
              </div>
              <div style={{ padding: 16 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topSitesOutbound} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="qty" name="Outbound Qty" fill="#ea580c" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Sites Inbound */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Top 10 Site Berdasarkan Inbound (Return) Qty</span>
              </div>
              <div style={{ padding: 16 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topSitesInbound} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="qty" name="Inbound Qty" fill="#16a34a" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Transaksi */}
      {txModalData && (
        <Modal
          isOpen={Boolean(txModalData)}
          onClose={() => setTxModalData(null)}
          title={`Riwayat Transaksi: ${txModalData.siteName} (${txModalData.monthLabel})`}
        >
          <div style={{ marginBottom: 12, display: "flex", gap: 12, fontSize: 12, color: "var(--text2)", flexWrap: "wrap" }}>
            <span><strong>Site ID:</strong> {txModalData.siteId}</span>
            <span><strong>Periode:</strong> {txModalData.monthLabel}</span>
            <span><strong>Gudang:</strong> {txModalData.warehouses.join(", ") || "-"}</span>
            <span><strong>Total Inbound:</strong> {formatNumber(txModalData.inboundQty)}</span>
            <span><strong>Total Outbound:</strong> {formatNumber(txModalData.outboundQty)}</span>
          </div>

          <div className="table-wrap" style={{ maxHeight: 400 }}>
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Tanggal</th>
                  <th>No. Nota</th>
                  <th>Tipe</th>
                  <th>Gudang</th>
                  <th>Material</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th>Unit</th>
                  <th>PIC / Vendor</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {txModalData.transactions.map((tx, idx) => (
                  <tr key={tx.id || idx}>
                    <td style={{ color: "var(--text3)" }}>{idx + 1}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {tx.date ? tx.date.split("T")[0] : "-"}
                    </td>
                    <td style={{ fontFamily: "monospace", color: "var(--blue)" }}>
                      {tx.notaNo || "-"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "var(--radius)",
                          background: (tx.transactionType || "").includes("OUT")
                            ? "var(--orange-light)"
                            : "var(--green-light)",
                          color: (tx.transactionType || "").includes("OUT")
                            ? "var(--orange)"
                            : "var(--green)",
                        }}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td>{tx.whGci || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{tx.materialName}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{formatNumber(tx.qty)}</td>
                    <td>{tx.unit || "-"}</td>
                    <td>{tx.picDelivery || tx.vendorSupplier || "-"}</td>
                    <td style={{ maxWidth: 200, fontSize: 11, color: "var(--text3)" }}>{tx.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
