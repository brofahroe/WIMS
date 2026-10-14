import * as XLSX from "xlsx";
import type { ExportTemplateRow, MaterialItem, SiteItem, TransactionRecord } from "../types";
import { EXPORT_TEMPLATE_COLUMNS } from "../types";
import { compareText } from "./wims";

/**
 * Menentukan Gudang Asal dan Gudang Tujuan berdasarkan tipe transaksi.
 */
export function resolveWarehouseOriginDestination(row: TransactionRecord): {
  gudangAsal: string;
  gudangTujuan: string;
} {
  const t = (row.transactionType || "").toUpperCase().trim();

  if (t === "INBOUND") {
    return {
      gudangAsal: row.sourceDestination || row.vendorSupplier || "Vendor / Supplier",
      gudangTujuan: row.whGci || "",
    };
  }

  if (t === "OUTBOUND") {
    return {
      gudangAsal: row.whGci || "",
      gudangTujuan: row.siteName || row.siteId || row.sourceDestination || "Site Project",
    };
  }

  if (t === "TRANSFER IN") {
    return {
      gudangAsal: row.sourceWarehouseGci || row.sourceDestination || "",
      gudangTujuan: row.whGci || "",
    };
  }

  if (t === "TRANSFER OUT") {
    return {
      gudangAsal: row.whGci || "",
      gudangTujuan: row.destinationWarehouseGci || row.sourceDestination || "",
    };
  }

  if (t === "BORROW IN") {
    return {
      gudangAsal: row.sourceDestination || row.vendorSupplier || "Pihak Ketiga",
      gudangTujuan: row.whGci || "",
    };
  }

  if (t === "BORROW OUT") {
    return {
      gudangAsal: row.whGci || "",
      gudangTujuan: row.sourceDestination || row.vendorSupplier || row.siteName || "Peminjam",
    };
  }

  return {
    gudangAsal: row.sourceWarehouseGci || row.whGci || row.sourceDestination || "",
    gudangTujuan: row.destinationWarehouseGci || row.sourceDestination || row.siteName || "",
  };
}

/**
 * Menentukan Cluster berdasarkan kode site, nama site, atau remarks.
 */
export function resolveCluster(row: TransactionRecord, site?: SiteItem): string {
  if (row.cluster && row.cluster.trim()) return row.cluster.trim();

  // Pola kode cluster telekomunikasi (contoh: CLR51-02-014)
  if (row.siteId && /^CLR/i.test(row.siteId)) return row.siteId.trim();
  if (site?.siteId && /^CLR/i.test(site.siteId)) return site.siteId.trim();

  // Cek jika remarks mencantumkan info cluster
  const remarksMatch = (row.remarks || "").match(/cluster\s+([^,\n\r;]+)/i);
  if (remarksMatch && remarksMatch[0]) return remarksMatch[0].trim();

  if (row.siteName && /cluster/i.test(row.siteName)) return row.siteName.trim();
  if (site?.siteName && /cluster/i.test(site.siteName)) return site.siteName.trim();

  return row.siteId || site?.siteId || "";
}

/**
 * Menentukan Sumber Material dari master material atau data transaksi.
 */
export function resolveSumberMaterial(row: TransactionRecord, material?: MaterialItem): string {
  if (material?.sourceMaterial && material.sourceMaterial.trim()) {
    return material.sourceMaterial.trim();
  }
  if (row.typeMaterial && row.typeMaterial.trim()) {
    return row.typeMaterial.trim();
  }
  return row.sourceDestination || row.vendorSupplier || "";
}

/**
 * Mengambil nama driver dan nomor telepon/HP driver.
 */
export function resolveDriverInfo(row: TransactionRecord): {
  namaDriver: string;
  noHpDriver: string;
} {
  let name = (row.picDelivery || "").trim();
  let phone = (row.driverPhone || "").trim();

  // Ekstrak jika nama driver memuat nomor kontak (contoh: "Mustofa - 08123456789")
  const m = name.match(/(?:08|\+628)[\d\s-]{8,15}/);
  if (m) {
    if (!phone) phone = m[0].replace(/[\s-]/g, "");
    name = name.replace(m[0], "").replace(/[-–—()]/g, "").trim();
  }

  // Cek apakah remarks mencatat no hp driver
  if (!phone && row.remarks) {
    const driverRemarks = row.remarks.match(/(?:driver|sopir|supir|hp|no\s*hp|wa|kontak)[^0-9\n]*((?:08|\+628)[\d\s-]{8,15})/i);
    if (driverRemarks && driverRemarks[1]) {
      phone = driverRemarks[1].replace(/[\s-]/g, "");
    }
  }

  return { namaDriver: name, noHpDriver: phone };
}

/**
 * Mengonversi satu record transaksi ke format ExportTemplateRow.
 */
export function transformToExportTemplateRow(
  record: TransactionRecord,
  materials?: MaterialItem[],
  sites?: SiteItem[],
): ExportTemplateRow {
  const mat = materials?.find(
    (m) =>
      (record.materialCode && compareText(m.materialCode, record.materialCode)) ||
      (record.materialName && compareText(m.materialName, record.materialName)),
  );

  const site = sites?.find(
    (s) =>
      (record.siteId && compareText(s.siteId, record.siteId)) ||
      (record.siteName && compareText(s.siteName, record.siteName)),
  );

  const { gudangAsal, gudangTujuan } = resolveWarehouseOriginDestination(record);
  const cluster = resolveCluster(record, site);
  const sumberMaterial = resolveSumberMaterial(record, mat);
  const { namaDriver, noHpDriver } = resolveDriverInfo(record);

  return {
    transactionType: record.transactionType || "",
    date: record.date ? record.date.split("T")[0].split(" ")[0] : "",
    gudangAsal,
    gudangTujuan,
    cluster,
    sumberMaterial,
    noTransaksi: record.notaNo || record.warehouseTransferId || record.tagId || record.id || "",
    noDo: record.doNumber || "",
    noDn: record.dnNumber || "",
    namaDriver,
    noHpDriver,
    kodeMaterial: record.materialCode || mat?.materialCode || "",
    namaMaterial: record.materialName || mat?.materialName || "",
    qty: Number(record.qty) || 0,
    kondisi: record.condition || "",
  };
}

/**
 * Mengonversi daftar baris ke array of array (AOA) sesuai urutan kolom template:
 * Tipe Transaksi - Tanggal - Gudang Asal - Gudang Tujuan - Cluster - Sumber Material -
 * No Transaksi / Group ID - No DO - No DN - Nama Driver - No HP Driver -
 * Kode Material - Nama Material - Qty - Kondisi
 */
export function exportTemplateRowsToAoa(rows: ExportTemplateRow[]): (string | number)[][] {
  const headers = [...EXPORT_TEMPLATE_COLUMNS];
  const dataRows = rows.map((r) => [
    r.transactionType,
    r.date,
    r.gudangAsal,
    r.gudangTujuan,
    r.cluster,
    r.sumberMaterial,
    r.noTransaksi,
    r.noDo,
    r.noDn,
    r.namaDriver,
    r.noHpDriver,
    r.kodeMaterial,
    r.namaMaterial,
    r.qty,
    r.kondisi,
  ]);
  return [headers, ...dataRows];
}

/**
 * Export data ke file Excel (.xlsx) dengan styling lebar kolom otomatis.
 */
export function exportTemplateRowsToExcel(rows: ExportTemplateRow[], filename?: string): void {
  const aoa = exportTemplateRowsToAoa(rows);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Estimasi lebar kolom otomatis
  const colWidths = EXPORT_TEMPLATE_COLUMNS.map((colName, colIdx) => {
    let maxLen = colName.length;
    for (let rowIdx = 1; rowIdx < aoa.length; rowIdx++) {
      const val = aoa[rowIdx][colIdx];
      const len = val !== null && val !== undefined ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Export Transaksi");
  const dateStr = new Date().toISOString().split("T")[0];
  const finalName = filename || `WIMS_Export_Transaksi_${dateStr}.xlsx`;
  XLSX.writeFile(wb, finalName);
}

/**
 * Export data ke file CSV (.csv) dengan format UTF-8 BOM.
 */
export function exportTemplateRowsToCsv(rows: ExportTemplateRow[], filename?: string): void {
  const aoa = exportTemplateRowsToAoa(rows);
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent = "\uFEFF" + aoa.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().split("T")[0];
  link.setAttribute("download", filename || `WIMS_Export_Transaksi_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
