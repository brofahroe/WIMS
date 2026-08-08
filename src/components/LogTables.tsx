import { Download, Search, Edit2, Trash2, Image, Save, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord, UserRole } from "../types";
import { formatNumber, normalizeText, safeReplace } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";
import { Modal } from "./ui/Modal";
import { NotaDetailModal } from "./NotaDetailModal";
import { ProofGallery } from "./ProofGallery";

interface LogTablesProps {
  logRows: TransactionRecord[];
  currentUserRole?: UserRole;
  onMaterialClick?: (materialName: string) => void;
  onDrumClick?: (drumNumber: string) => void;
  onUpdateTransaction?: (id: string, updates: Partial<TransactionRecord>) => Promise<boolean>;
  onSoftDeleteTransaction?: (id: string) => Promise<boolean>;
  onApproveTransaction?: (id: string) => void;
  onRejectTransaction?: (id: string) => void;
}

export function LogTables({ logRows, currentUserRole, onMaterialClick, onDrumClick, onUpdateTransaction, onSoftDeleteTransaction, onApproveTransaction, onRejectTransaction }: LogTablesProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedNota, setSelectedNota] = useState<string | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  // Bug #4 fix: state for inline edit modal
  const [editingRow, setEditingRow] = useState<TransactionRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<TransactionRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  const selectedNotaRows = useMemo(() => {
    if (!selectedNota) return [];
    return logRows.filter(r => r.notaNo === selectedNota);
  }, [selectedNota, logRows]);
  
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

  // Bug #4 fix: open modal with a copy of the row to edit
  const handleOpenEdit = (row: TransactionRecord) => {
    setEditingRow(row);
    setEditForm({
      qty: row.qty,
      condition: row.condition ?? "",
      remarks: row.remarks ?? "",
      picDelivery: row.picDelivery ?? "",
      vendorSupplier: row.vendorSupplier ?? "",
      doNumber: row.doNumber ?? "",
      dnNumber: row.dnNumber ?? "",
      siteName: row.siteName ?? "",
      siteId: row.siteId ?? "",
      carPlate: row.carPlate ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRow || !onUpdateTransaction) return;
    setIsSaving(true);
    const success = await onUpdateTransaction(editingRow.id, editForm);
    setIsSaving(false);
    if (success) {
      setEditingRow(null);
    }
  };

  const handleExportCsv = () => {
    const headers = ["#", "Tipe", "Nota No.", "WH", "Tanggal", "Source/Dest", "Material", "Kode", "Qty", "Unit", "Site ID", "Site Name", "DO Number", "Kondisi", "PIC Del.", "Vendor", "Ket."];
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
      `"${r.siteId || ""}"`,
      `"${r.siteName || ""}"`,
      `"${r.doNumber || ""}"`,
      `"${r.condition || ""}"`,
      `"${r.picDelivery || ""}"`,
      `"${r.vendorSupplier || ""}"`,
      `"${safeReplace(r.remarks, /\n/g, " ")}"`
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

  const types = ["INBOUND", "OUTBOUND", "BORROW IN", "BORROW OUT", "TRANSFER IN", "TRANSFER OUT"];

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
            className="search-field"
            style={{ paddingLeft: 34, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <select 
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input"
          style={{ padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <option value="ALL">Semua Tipe</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select 
          value={whFilter} 
          onChange={(e) => setWhFilter(e.target.value)}
          className="input"
          style={{ padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <option value="ALL">Semua WH</option>
          {warehouses.map(w => <option key={w as string} value={w as string}>{w as string}</option>)}
        </select>
        <button className="btn" onClick={handleExportCsv}>
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
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} align="right" />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Haspel/Drum" sortKey="drumNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site Name" sortKey="siteName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="DO Number" sortKey="doNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Kondisi" sortKey="condition" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="PIC Del." sortKey="picDelivery" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Vendor" sortKey="vendorSupplier" currentSort={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Ket." sortKey="remarks" currentSort={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Approval" sortKey="approvalStatus" currentSort={sortConfig} requestSort={requestSort} />
                  <th style={{ width: 50 }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => (
                <tr key={row.id}>
                  <td>{String(idx + 1).padStart(3, "0")}</td>
                  <td>
                    <span className={`badge ${row.transactionType?.includes("INBOUND") || row.transactionType === "RETURN IN" ? "badge-inbound" : "badge-outbound"}`}>
                      {row.transactionType}
                    </span>
                  </td>
                   <td className="mono">
                     <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                       <button className="btn-link" onClick={() => setSelectedNota(row.notaNo)} title="View Detail Nota">
                         {row.notaNo}
                       </button>
                       {row.proofLink && (
                         <button
                           onClick={() => setGalleryImages([row.proofLink!])}
                           title="Lihat Bukti Foto"
                           className="icon-button"
                           style={{ width: 36, height: 36 }}
                         >
                           <Image size={16} />
                         </button>
                       )}
                     </div>
                   </td>
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
                  <td className="numeric"><b>{formatNumber(row.qty)}</b></td>
                  <td>{row.unit}</td>
                  <td style={{ fontSize: 12, color: "var(--blue)" }}>
                    {(() => {
                      const drumId = row.drumNumber || row.tagId;
                      if (!drumId) return "-";
                      if (onDrumClick) {
                        return (
                          <span 
                            onClick={() => onDrumClick(drumId)}
                            style={{ cursor: "pointer", textDecoration: "underline", color: "var(--primary)", fontWeight: 500 }}
                          >
                            {drumId}
                          </span>
                        );
                      }
                      return drumId;
                    })()}
                  </td>
                  <td>{row.siteId || "-"}</td>
                  <td>{row.siteName || "-"}</td>
                  <td className="mono">{row.doNumber || "-"}</td>
                  <td>{row.condition || "-"}</td>
                  <td>{row.picDelivery || "-"}</td>
                  <td>{row.vendorSupplier || "-"}</td>
                  <td style={{ fontSize: 11 }}>{row.remarks || "-"}</td>
                  <td>
                    {row.approvalStatus === "PENDING" && (
                      <span className="badge" style={{ background: "var(--orange)", color: "white" }}>PENDING</span>
                    )}
                    {row.approvalStatus === "APPROVED" && (
                      <span className="badge" style={{ background: "var(--green)", color: "white" }}>APPROVED</span>
                    )}
                    {row.approvalStatus === "REJECTED" && (
                      <span className="badge" style={{ background: "var(--red)", color: "white" }}>REJECTED</span>
                    )}
                    {!row.approvalStatus && <span style={{ color: "var(--text3)" }}>-</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="icon-button" style={{ width: 36, height: 36 }} title="Edit" onClick={() => handleOpenEdit(row)}>
                        <Edit2 size={16} color="var(--blue)" />
                      </button>
                      {row.approvalStatus === "PENDING" && currentUserRole === "Manager" && (
                        <>
                          <button className="icon-button" style={{ width: 36, height: 36 }} title="Approve" onClick={() => onApproveTransaction?.(row.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </button>
                          <button className="icon-button" style={{ width: 36, height: 36 }} title="Reject" onClick={() => onRejectTransaction?.(row.id)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </>
                      )}
                      {onSoftDeleteTransaction && (
                        <button className="icon-button" style={{ width: 36, height: 36 }} title="Hapus" onClick={() => onSoftDeleteTransaction(row.id)}>
                          <Trash2 size={16} color="var(--red)" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={18} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada transaksi yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedNota && (
        <NotaDetailModal
          notaNo={selectedNota}
          rows={selectedNotaRows}
          onClose={() => setSelectedNota(null)}
          onUpdateTransaction={onUpdateTransaction}
        />
      )}
      {galleryImages.length > 0 && (
        <ProofGallery
          images={galleryImages}
          onClose={() => setGalleryImages([])}
        />
      )}

      {/* Bug #4 fix: inline edit modal for logfile rows */}
      <Modal isOpen={!!editingRow} onClose={() => setEditingRow(null)} title={`Edit Transaksi — ${editingRow?.notaNo ?? ""}`}>
        {editingRow && (
          <div>
            <div style={{ marginBottom: 10, fontSize: 12, color: "var(--text3)" }}>
              Hanya field yang aman untuk diedit yang ditampilkan. Tipe transaksi dan material tidak dapat diubah dari sini.
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Qty</label>
                <input
                  type="number"
                  value={String(editForm.qty ?? "")}
                  onChange={(e) => setEditForm((f) => ({ ...f, qty: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label>Kondisi</label>
                <input
                  value={editForm.condition ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>PIC Delivery</label>
                <input
                  value={editForm.picDelivery ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, picDelivery: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Vendor / Supplier</label>
                <input
                  value={editForm.vendorSupplier ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, vendorSupplier: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Site Name</label>
                <input
                  value={editForm.siteName ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, siteName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Site ID</label>
                <input
                  value={editForm.siteId ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, siteId: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>DO Number</label>
                <input
                  value={editForm.doNumber ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, doNumber: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>DN Number</label>
                <input
                  value={editForm.dnNumber ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, dnNumber: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>No. Polisi Kendaraan</label>
                <input
                  value={editForm.carPlate ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, carPlate: e.target.value }))}
                />
              </div>
              <div className="form-group span-2">
                <label>Keterangan</label>
                <textarea
                  rows={3}
                  value={editForm.remarks ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
                  style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", resize: "vertical" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" className="btn" onClick={() => setEditingRow(null)}>
                <X size={14} style={{ marginRight: 4 }} /> Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSaving || !onUpdateTransaction}
                onClick={handleSaveEdit}
              >
                <Save size={14} style={{ marginRight: 4 }} />
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <div id="log-count" style={{ fontSize: 12, color: "var(--text3)", marginTop: 12, textAlign: "right" }}>
        Menampilkan {filteredRows.length} dari {logRows.length} transaksi
      </div>
    </div>
  );
}
