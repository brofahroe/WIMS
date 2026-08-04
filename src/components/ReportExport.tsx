import React, { useMemo, useRef, useState } from "react";
import { Download, FileDown, FileUp, Printer, Save, Webhook, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import type { InventoryRow, MaterialItem, SiteItem, TransactionRecord } from "../types";
import { buildTransactionExport, sendToWebhook } from "../lib/integration";

interface ReportExportProps {
  logRows: TransactionRecord[];
  inventory: InventoryRow[];
  sites: SiteItem[];
  materials: MaterialItem[];
  onImport: (logRows: TransactionRecord[]) => void;
}

export function ReportExport({ logRows, inventory, sites, materials, onImport }: ReportExportProps) {
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const txSummary: Record<string, number> = {};
  logRows.forEach((r) => {
    const t = r.transactionType || "UNKNOWN";
    txSummary[t] = (txSummary[t] || 0) + 1;
  });

  const txByTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    logRows.forEach((r) => {
      const t = r.transactionType || "UNKNOWN";
      map[t] = (map[t] || 0) + Number(r.qty || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [logRows]);

  const stockByWhData = useMemo(() => {
    const map: Record<string, number> = {};
    inventory.forEach((item) => {
      const wh = item.stockWhCalc || 0;
      map["Stok WH"] = (map["Stok WH"] || 0) + wh;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  const dailyTxData = useMemo(() => {
    const map: Record<string, { inbound: number; outbound: number; transfer: number; borrow: number }> = {};
    logRows.forEach((r) => {
      const date = r.date ? r.date.split(" ")[0]?.split("T")[0] : "Unknown";
      if (!map[date]) map[date] = { inbound: 0, outbound: 0, transfer: 0, borrow: 0 };
      const t = (r.transactionType || "").toUpperCase();
      if (t.includes("INBOUND")) map[date].inbound += Number(r.qty || 0);
      else if (t.includes("OUTBOUND")) map[date].outbound += Number(r.qty || 0);
      else if (t.includes("TRANSFER")) map[date].transfer += Number(r.qty || 0);
      else if (t.includes("BORROW")) map[date].borrow += Number(r.qty || 0);
    });
    return Object.entries(map)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [logRows]);

  const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

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
      } catch {
        alert("Gagal membaca file JSON.");
      }
    };
    reader.readAsText(file);
    if (jsonInputRef.current) jsonInputRef.current.value = "";
  };

  const handleWebhookExport = async (format: "json" | "csv" | "xml") => {
    if (!webhookUrl.trim()) {
      alert("Masukkan URL webhook terlebih dahulu.");
      return;
    }
    setWebhookStatus("Mengirim...");
    const exportData = buildTransactionExport(logRows, format);
    const success = await sendToWebhook(webhookUrl, exportData.data);
    setWebhookStatus(success ? "Berhasil dikirim" : "Gagal mengirim");
    setTimeout(() => setWebhookStatus(null), 3000);
  };

   const handleExportIntegration = (format: "json" | "csv" | "xml") => {
    const exportData = buildTransactionExport(logRows, format);
    const blob = new Blob([exportData.data as string], { type: format === "csv" ? "text/csv;charset=utf-8;" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", exportData.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
   };

   const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const logHeaders = ["ID","Tipe","Nota No","Tanggal","WH","Material","Kode","Qty","Unit","Drum","Site ID","Site Name","DO Number","Kondisi","Tagging","PIC","Vendor","Keterangan"];
    const logRows_data = logRows.map((r) => [
      r.id, r.transactionType, r.notaNo, r.date?.split("T")[0] || "", r.whGci,
      r.materialName, r.materialCode, r.qty, r.unit, r.drumNumber || r.tagId || "",
      r.siteId, r.siteName, r.doNumber, r.condition, r.taggingType, r.picDelivery,
      r.vendorSupplier, r.remarks
    ]);
    const wsLog = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows_data]);
    XLSX.utils.book_append_sheet(wb, wsLog, "Logfile");

    const invHeaders = ["Kode","Nama Material","Tipe","Unit","Inbound","Outbound","Transfer In","Transfer Out","Borrow In","Borrow Out","Stok WH","LO Stock"];
    const invRows_data = inventory.map((m) => [
      m.materialCode, m.materialName, m.typeMaterial, m.unit,
      m.inbound, m.outbound, m.transferIn, m.transferOut,
      m.borrowIn, m.borrowOut, m.stockWhCalc, m.leftoversStockCalc
    ]);
    const wsInv = XLSX.utils.aoa_to_sheet([invHeaders, ...invRows_data]);
    XLSX.utils.book_append_sheet(wb, wsInv, "Stok Material");

    const siteHeaders = ["Site ID","Site Name","Kota","Region","Team","Milestone"];
    const siteRows_data = sites.map((s) => [s.siteId, s.siteName, s.city, s.region, s.team, s.finalMilestone]);
    const wsSite = XLSX.utils.aoa_to_sheet([siteHeaders, ...siteRows_data]);
    XLSX.utils.book_append_sheet(wb, wsSite, "Site Database");

    const doHeaders = ["Site ID","Site Name","Subcon","Region","City","DO Number","DN Number","Material","Qty"];
    const doRows_data = (logRows as any[]).filter((r) => r.doNumber).map((r) => [
      r.siteId, r.siteName, "", "", "", r.doNumber, r.dnNumber, r.materialName, r.qty
    ]);
    const wsDO = XLSX.utils.aoa_to_sheet([doHeaders, ...doRows_data]);
    XLSX.utils.book_append_sheet(wb, wsDO, "Delivery Orders");

    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `WIMS_Export_${dateStr}.xlsx`);
   };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets["Logfile"];
        if (!sheet) {
          alert("Sheet 'Logfile' tidak ditemukan di file Excel.");
          return;
        }
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Bug #7 fix: locate the actual header row dynamically instead of
        // relying on a hardcoded row index. Look for the row that contains
        // "transactionType" or "Tipe" (case-insensitive) in one of its cells.
        const VALID_TX_TYPES = new Set([
          "INBOUND", "OUTBOUND", "BORROW IN", "BORROW OUT", "TRANSFER IN", "TRANSFER OUT",
        ]);
        const importedRows: TransactionRecord[] = [];
        let skippedCount = 0;

        // Find the header row index by scanning for a row whose cells look like
        // column names (contain "type" or "nota" or "material").
        let dataStartIdx = 1; // default: skip first row as header
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const combined = row.map((c: unknown) => String(c ?? "").toLowerCase()).join(" ");
          if (combined.includes("tipe") || combined.includes("type") || combined.includes("nota")) {
            dataStartIdx = i + 1;
            break;
          }
        }

        for (let i = dataStartIdx; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 13) continue;

          // Bug #7 fix: validate that transactionType is a known value before import.
          const txType = String(row[2] || "").trim().toUpperCase();
          if (!txType) continue; // skip blank rows
          if (!VALID_TX_TYPES.has(txType)) {
            skippedCount++;
            continue;
          }

          importedRows.push({
            id: crypto.randomUUID(),
            source: "logfile",
            rowId: String(row[0] || ""),
            lineId: Number(row[1]) || null,
            transactionType: txType,
            notaNo: String(row[3] || ""),
            whGci: String(row[4] || ""),
            picWarehouse: String(row[5] || ""),
            date: String(row[6] || ""),
            time: String(row[7] || ""),
            sourceDestination: String(row[8] || ""),
            typeMaterial: String(row[9] || ""),
            materialName: String(row[10] || ""),
            materialCode: String(row[11] || ""),
            unit: String(row[12] || ""),
            qty: Number(row[13]) || 0,
            siteId: String(row[14] || ""),
            siteName: String(row[15] || ""),
            doNumber: String(row[16] || ""),
            dnNumber: String(row[17] || ""),
            condition: String(row[18] || ""),
            picDelivery: String(row[19] || ""),
            vendorSupplier: String(row[20] || ""),
            idCard: String(row[21] || ""),
            carPlate: String(row[22] || ""),
            remarks: String(row[23] || ""),
            taggingType: "LOGFILE",
            taggingManual: "",
            cableLengthMarker: "",
            cableRoll: "",
            inOutQty: 0,
            loCriteria: "",
            drumNumber: String(row[24] || ""),
            proofLink: "",
            approvalStatus: "APPROVED",
          });
        }
        if (importedRows.length === 0) {
          alert("Tidak ada data valid yang ditemukan di sheet Logfile.");
          return;
        }
        const skipMsg = skippedCount > 0 ? `\n(${skippedCount} baris dilewati karena tipe transaksi tidak valid)` : "";
        if (window.confirm(`Import ${importedRows.length} baris dari Excel?\nData saat ini akan tertimpa.${skipMsg}`)) {
          onImport(importedRows);
          alert(`Berhasil import ${importedRows.length} baris.${skipMsg}`);
        }
      } catch (err) {
        console.error("Import Excel error:", err);
        alert("Gagal membaca file Excel. Pastikan format file sesuai template WIMS.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (excelInputRef.current) excelInputRef.current.value = "";
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
            
             <button className="btn" onClick={handleExportExcel} style={{ justifyContent: "flex-start" }}>
               <Download size={16} style={{ marginRight: 8, color: "var(--blue)" }} /> Export ke Excel (.xlsx)
             </button>
             <button className="btn" onClick={() => excelInputRef.current?.click()} style={{ justifyContent: "flex-start" }}>
               <Upload size={16} style={{ marginRight: 8, color: "var(--green)" }} /> Import dari Excel (.xlsx)
             </button>
             <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} ref={excelInputRef} onChange={handleImportExcel} />

             <div className="divider" style={{ borderBottom: "1px solid var(--border)", margin: "8px 0" }}></div>
             
             <button className="btn" onClick={printNota} style={{ justifyContent: "flex-start" }}>
               <Printer size={16} style={{ marginRight: 8 }} /> Print Nota Terakhir
             </button>
             <button className="btn btn-primary" onClick={handleBackupJson} style={{ justifyContent: "flex-start" }}>
               <Save size={16} style={{ marginRight: 8 }} /> Backup Data ke JSON
             </button>
             <button className="btn" onClick={() => jsonInputRef.current?.click()} style={{ justifyContent: "flex-start" }}>
               <FileUp size={16} style={{ marginRight: 8 }} /> Restore dari JSON
             </button>
             <input type="file" accept=".json" style={{ display: "none" }} ref={jsonInputRef} onChange={handleImportJson} />

            <div className="divider" style={{ borderBottom: "1px solid var(--border)", margin: "12px 0" }}></div>
            <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, marginBottom: 4 }}>INTEGRASI ERP / WEBHOOK</div>
            <input
              type="url"
              placeholder="https://erp.example.com/api/wims/sync"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg)", fontSize: 12 }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => handleWebhookExport("json")} style={{ flex: 1 }}>
                <Webhook size={12} style={{ marginRight: 4 }} /> Kirim JSON
              </button>
              <button className="btn btn-sm" onClick={() => handleWebhookExport("csv")} style={{ flex: 1 }}>
                <Webhook size={12} style={{ marginRight: 4 }} /> Kirim CSV
              </button>
            </div>
            {webhookStatus && <div style={{ fontSize: 11, color: webhookStatus.includes("Berhasil") ? "var(--green)" : "var(--red)" }}>{webhookStatus}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => handleExportIntegration("json")} style={{ flex: 1 }}>Export JSON</button>
              <button className="btn btn-sm" onClick={() => handleExportIntegration("csv")} style={{ flex: 1 }}>Export CSV</button>
              <button className="btn btn-sm" onClick={() => handleExportIntegration("xml")} style={{ flex: 1 }}>Export XML</button>
            </div>
          </div>
        </div>

        <div>
          {/* Analytics Charts */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Analytics Transaksi</span></div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Volume per Tipe Transaksi (Qty)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={txByTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Tren Harian (30 hari terakhir)</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dailyTxData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="inbound" stroke="#10b981" name="Inbound" strokeWidth={2} />
                    <Line type="monotone" dataKey="outbound" stroke="#ef4444" name="Outbound" strokeWidth={2} />
                    <Line type="monotone" dataKey="transfer" stroke="#f59e0b" name="Transfer" strokeWidth={2} />
                    <Line type="monotone" dataKey="borrow" stroke="#8b5cf6" name="Borrow" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Distribusi Stok</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stockByWhData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {stockByWhData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

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
