import { Download, Edit2, Printer, Save, X } from "lucide-react";
import { useState } from "react";
import type { TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";
import { ReceiptModal } from "./ReceiptModal";

interface NotaDetailModalProps {
  notaNo: string;
  rows: TransactionRecord[];
  onClose: () => void;
  onUpdateTransaction?: (id: string, updates: Partial<TransactionRecord>) => Promise<boolean>;
}

export function NotaDetailModal({ notaNo, rows, onClose, onUpdateTransaction }: NotaDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editStates, setEditStates] = useState<Record<string, Partial<TransactionRecord>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const firstRow = rows[0];
  if (!firstRow) return null;

  const handleEditChange = (id: string, field: keyof TransactionRecord, value: any) => {
    setEditStates(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!onUpdateTransaction) return;
    setIsSaving(true);
    
    let allSuccess = true;
    for (const [id, updates] of Object.entries(editStates)) {
      if (Object.keys(updates).length > 0) {
         const success = await onUpdateTransaction(id, updates);
         if (!success) allSuccess = false;
      }
    }
    
    setIsSaving(false);
    if (allSuccess) {
      setIsEditing(false);
      setEditStates({});
    } else {
      alert("Beberapa pembaruan gagal disimpan.");
    }
  };

  const handleExportCsv = () => {
    const headers = ["#", "Tipe", "Material", "Qty", "Unit", "Site", "Kondisi", "Drum Number", "Ket"];
    const csvRows = rows.map((r, idx) => [
      `${idx + 1}`,
      `"${r.transactionType || ""}"`,
      `"${r.materialName || ""}"`,
      `"${r.qty || 0}"`,
      `"${r.unit || ""}"`,
      `"${r.siteName || ""}"`,
      `"${r.condition || ""}"`,
      `"${r.drumNumber || r.tagId || ""}"`,
      `"${(r.remarks || "").replace(/\n/g, " ")}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Nota_${notaNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (showReceipt) {
    return <ReceiptModal notaNo={notaNo} rows={rows} onClose={() => setShowReceipt(false)} />;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 900 }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 16 }}>Detail Nota: <span className="mono">{notaNo}</span></h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, fontSize: 13, background: "var(--surface)", padding: 12, borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 4 }}>Informasi Utama</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>Tipe Transaksi:</span>
                <strong>{firstRow.transactionType}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>Tanggal:</span>
                <strong>{firstRow.date?.split("T")[0]?.split(" ")[0]}</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>Gudang (WH):</span>
                <strong>{firstRow.whGci}</strong>
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 4 }}>Referensi</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>Source/Dest:</span>
                <strong>{firstRow.sourceDestination || "-"}</strong>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>DO Number:</span>
                <strong>{firstRow.doNumber || "-"}</strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ width: 100, color: "var(--text2)" }}>PIC WH:</span>
                <strong>{firstRow.picWarehouse || "-"}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>Daftar Item ({rows.length})</h4>
            <div style={{ display: "flex", gap: 8 }}>
              {isEditing ? (
                <>
                  <button className="btn btn-sm" onClick={() => { setIsEditing(false); setEditStates({}); }} disabled={isSaving}>
                    Batal
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
                    <Save size={14} style={{ marginRight: 6 }} /> {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </>
              ) : (
                <>
                  {onUpdateTransaction && (
                    <button className="btn btn-sm" onClick={() => setIsEditing(true)}>
                      <Edit2 size={14} style={{ marginRight: 6 }} /> Edit Data
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={handleExportCsv}>
                    <Download size={14} style={{ marginRight: 6 }} /> Export CSV
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowReceipt(true)}>
                    <Printer size={14} style={{ marginRight: 6 }} /> Print Nota
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table style={{ fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
                <tr>
                  <th>No.</th>
                  <th>Material</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Kondisi</th>
                  <th>Drum Number</th>
                  <th>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const edits = editStates[row.id] || {};
                  const currentQty = edits.qty !== undefined ? edits.qty : row.qty;
                  const currentCondition = edits.condition !== undefined ? edits.condition : (row.condition || "");
                  const currentDrum = edits.drumNumber !== undefined ? edits.drumNumber : (row.drumNumber || row.tagId || "");
                  const currentRemarks = edits.remarks !== undefined ? edits.remarks : (row.remarks || "");

                  return (
                    <tr key={row.id}>
                      <td>{idx + 1}</td>
                      <td>{row.materialName}</td>
                      {isEditing ? (
                        <>
                          <td>
                            <input type="number" step="0.01" style={{ width: 70, padding: 4 }} value={currentQty} onChange={(e) => handleEditChange(row.id, "qty", Number(e.target.value) || 0)} />
                          </td>
                          <td>{row.unit}</td>
                          <td>
                            <input type="text" style={{ width: 90, padding: 4 }} value={currentCondition || ""} onChange={(e) => handleEditChange(row.id, "condition", e.target.value)} />
                          </td>
                          <td>
                            <input type="text" style={{ width: 100, padding: 4 }} value={currentDrum || ""} onChange={(e) => handleEditChange(row.id, "drumNumber", e.target.value)} />
                          </td>
                          <td>
                            <input type="text" style={{ width: "100%", padding: 4 }} value={currentRemarks || ""} onChange={(e) => handleEditChange(row.id, "remarks", e.target.value)} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 600 }}>{formatNumber(row.qty)}</td>
                          <td>{row.unit}</td>
                          <td>{row.condition || "-"}</td>
                          <td style={{ color: "var(--blue)" }}>{row.drumNumber || row.tagId || "-"}</td>
                          <td>{row.remarks || "-"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
