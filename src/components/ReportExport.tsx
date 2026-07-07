import React, { useRef } from "react";
import { Download, FileDown, FileUp, Printer, Save } from "lucide-react";
import type { InventoryRow, MaterialItem, SiteItem, TransactionRecord } from "../types";

interface ReportExportProps {
  logRows: TransactionRecord[];
  inventory: InventoryRow[];
  sites: SiteItem[];
  materials: MaterialItem[];
  onImport: (logRows: TransactionRecord[]) => void;
}

export function ReportExport({ logRows, inventory, sites, materials, onImport }: ReportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const txSummary: Record<string, number> = {};
  logRows.forEach((r) => {
    const t = r.transactionType || "UNKNOWN";
    txSummary[t] = (txSummary[t] || 0) + 1;
  });

  const exportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLog = () => {
    const headers = ["ID", "Tipe", "Nota No", "Tanggal", "WH", "Material", "Kode", "Qty", "Unit", "Drum No.", "Site ID", "Site Name", "DO Number", "DN Number", "Kondisi", "Tag", "PIC", "Vendor", "Keterangan"];
    const rows = logRows.map(r => [
      `"${r.id}"`, `"${r.transactionType || ""}"`, `"${r.notaNo || ""}"`, `"${r.date?.split(" ")[0]?.split("T")[0] || ""}"`, `"${r.whGci || ""}"`,
      `"${r.materialName || ""}"`, `"${r.materialCode || ""}"`, `"${r.qty || 0}"`, `"${r.unit || ""}"`, `"${r.drumNumber || ""}"`,
      `"${r.siteId || ""}"`, `"${r.siteName || ""}"`, `"${r.doNumber || ""}"`, `"${r.dnNumber || ""}"`,
      `"${r.condition || ""}"`, `"${r.taggingType || ""}"`, `"${r.picDelivery || ""}"`, `"${r.vendorSupplier || ""}"`, `"${(r.remarks || "").replace(/\n/g, " ")}"`
    ]);
    exportCSV("WIMS_Logfile.csv", headers, rows);
  };

  const handleExportStok = () => {
    const headers = ["Kode", "Nama Material", "Tipe", "Unit", "Inbound", "Outbound", "Stok WH"];
    const rows = inventory.map(m => [
      `"${m.materialCode}"`, `"${m.materialName}"`, `"${m.typeMaterial}"`, `"${m.unit}"`,
      `"${m.inboundCalc}"`, `"${m.outboundCalc}"`, `"${m.stockWhCalc}"`
    ]);
    exportCSV("WIMS_Stok.csv", headers, rows);
  };

  const handleExportSite = () => {
    const headers = ["Site ID", "Site Name", "City", "WH Drop", "Team", "Milestone"];
    const rows = sites.map(s => [
      `"${s.siteId}"`, `"${s.siteName}"`, `"${s.city || ""}"`, `"${s.region || ""}"`, `"${s.team || ""}"`, `"${s.finalMilestone || ""}"`
    ]);
    exportCSV("WIMS_Site.csv", headers, rows);
  };

  const handleExportMat = () => {
    const headers = ["Kode", "Nama Material", "Tipe", "Sumber", "Unit"];
    const rows = materials.map(m => [
      `"${m.materialCode}"`, `"${m.materialName}"`, `"${m.typeMaterial}"`, `"${m.sourceMaterial}"`, `"${m.unit}"`
    ]);
    exportCSV("WIMS_Material.csv", headers, rows);
  };

  const handleBackupJson = () => {
    const data = { logRows, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `WIMS_Backup_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (data && Array.isArray(data.logRows)) {
          if (window.confirm(`Restore ${data.logRows.length} transaksi dari backup?\nData saat ini akan tertimpa.`)) {
            onImport(data.logRows);
            alert("Restore berhasil!");
          }
        } else {
          alert("Format file backup tidak valid. Harus mengandung array logRows.");
        }
      } catch (err) {
        alert("Gagal membaca file JSON.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const printNota = () => {
    // We navigate to nota page or trigger print.
    // Since printNota needs to print the last nota, we can just call window.print() and let CSS handle it
    // But we need the nota panel. We will just alert the user to use the Nota Print menu.
    alert("Silakan buka menu Referensi > Nota Print untuk mencetak nota.");
  };

  return (
    <div className="page active" id="page-report">
      <div className="two-col">
        {/* Export Data Card */}
        <div className="card">
          <div className="card-header"><span className="card-title">Export Data</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            <button className="btn" onClick={handleExportLog} style={{ justifyContent: "flex-start" }}>
              <FileDown size={16} style={{ marginRight: 8, color: "var(--blue)" }} /> Export Logfile Transaksi (CSV)
            </button>
            <button className="btn" onClick={handleExportStok} style={{ justifyContent: "flex-start" }}>
              <FileDown size={16} style={{ marginRight: 8, color: "var(--green)" }} /> Export Stok Material (CSV)
            </button>
            <button className="btn" onClick={handleExportSite} style={{ justifyContent: "flex-start" }}>
              <FileDown size={16} style={{ marginRight: 8, color: "var(--amber)" }} /> Export Site Database (CSV)
            </button>
            <button className="btn" onClick={handleExportMat} style={{ justifyContent: "flex-start" }}>
              <FileDown size={16} style={{ marginRight: 8, color: "var(--purple)" }} /> Export Master Material (CSV)
            </button>
            
            <div className="divider" style={{ borderBottom: "1px solid var(--border)", margin: "8px 0" }}></div>
            
            <button className="btn" onClick={printNota} style={{ justifyContent: "flex-start" }}>
              <Printer size={16} style={{ marginRight: 8 }} /> Print Nota Terakhir
            </button>
            <button className="btn btn-primary" onClick={handleBackupJson} style={{ justifyContent: "flex-start" }}>
              <Save size={16} style={{ marginRight: 8 }} /> Backup Data ke JSON
            </button>
            <button className="btn" onClick={() => fileInputRef.current?.click()} style={{ justifyContent: "flex-start" }}>
              <FileUp size={16} style={{ marginRight: 8 }} /> Restore dari JSON
            </button>
            <input type="file" accept=".json" style={{ display: "none" }} ref={fileInputRef} onChange={handleImportJson} />
          </div>
        </div>

        <div>
          {/* Summary Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Ringkasan Logfile</span></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tipe Transaksi</th>
                    <th>Jumlah Baris</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(txSummary).map(([type, count]) => (
                    <tr key={type}>
                      <td>{type}</td>
                      <td><strong>{count}</strong></td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>TOTAL BARIS</strong></td>
                    <td><strong>{logRows.length}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Nota Numbering Card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Nota Numbering Rules</span></div>
            <div className="table-wrap">
              <table style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Tipe</th>
                    <th>Prefix</th>
                    <th>Format Nota</th>
                    <th>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>INBOUND</td><td className="mono">INB</td><td className="mono">INB-WHYYMM-XXX</td><td>Barang masuk dari pusat</td></tr>
                  <tr><td>OUTBOUND</td><td className="mono">OUB</td><td className="mono">OUB-WHYYMM-XXX</td><td>Barang keluar ke site</td></tr>
                  <tr><td>BORROW IN</td><td className="mono">BOI</td><td className="mono">BOI-WHYYMM-XXX</td><td>Pinjam masuk dari WH lain</td></tr>
                  <tr><td>BORROW OUT</td><td className="mono">BOO</td><td className="mono">BOO-WHYYMM-XXX</td><td>Pinjam keluar ke WH lain</td></tr>
                  <tr><td>TRANSFER IN</td><td className="mono">TFI</td><td className="mono">TFI-WHYYMM-XXX</td><td>Mutasi masuk permanen</td></tr>
                  <tr><td>TRANSFER OUT</td><td className="mono">TFO</td><td className="mono">TFO-WHYYMM-XXX</td><td>Mutasi keluar permanen</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
