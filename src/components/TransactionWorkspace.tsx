import { AlertTriangle, Camera, Info, Play, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DeliveryOrder,
  InventoryRow,
  MasterData,
  MaterialItem,
  SiteItem,
  TransactionFormState,
  TransactionRecord,
} from "../types";
import {
  asDateInput,
  currentTime,
  deriveSiteOptions,
  formatNumber,
  generateNotaNo,
  getMaterial,
  getSiteOrder,
  getWarehouse,
  makeTempRecord,
  normalizeText,
  processTempRows,
  validateForm,
  movementSign,
  getAvailableReels,
} from "../lib/wims";
import { ReceiptModal } from "./ReceiptModal";
import { uploadProofImage } from "../lib/supabase";

interface TransactionWorkspaceProps {
  master: MasterData;
  materials: MaterialItem[];
  deliveryOrders: DeliveryOrder[];
  sites: SiteItem[];
  inventory: InventoryRow[];
  tempRows: TransactionRecord[];
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
  onAddTemp: (row: TransactionRecord) => void;
  onRemoveTemp: (id: string) => void;
  onClearTemp: () => void;
  onProcess: ReturnType<typeof processTempRows> extends infer T
    ? (result: T extends object ? T : never) => void
    : never;
  onPrintNota?: () => void;
  transactionGroup?: "INBOUND" | "OUTBOUND" | "TRANSFER" | "BORROW";
  defaultWarehouse?: string;
}

function defaultForm(master: MasterData, defaultWarehouse?: string): TransactionFormState {
  const firstWh = (defaultWarehouse && defaultWarehouse !== "ALL" ? defaultWarehouse : master.warehouses.find((item) => item.whGci && item.whGci !== "ALL")?.whGci) ?? "";
  return {
    taggingType: "LOGFILE",
    transactionType: "",
    notaNo: "",
    whGci: firstWh,
    date: asDateInput(),
    time: currentTime(),
    sourceDestination: "",
    materialName: "",
    qty: "",
    siteName: "",
    condition: "",
    picDelivery: "",
    vendorSupplier: "",
    idCard: "",
    carPlate: "",
    remarks: "",
    drumNumber: "",
    haspelSize: "3000",
    proofLink: "",
  };
}

export function TransactionWorkspace({
  master,
  materials,
  deliveryOrders,
  sites,
  inventory,
  tempRows,
  logRows,
  leftoverRows,
  onAddTemp,
  onRemoveTemp,
  onClearTemp,
  onProcess,
  onPrintNota,
  transactionGroup,
  defaultWarehouse,
}: TransactionWorkspaceProps) {
  const [form, setForm] = useState<TransactionFormState>(() => defaultForm(master, defaultWarehouse));
  const [submitted, setSubmitted] = useState(false);
  const [receiptData, setReceiptData] = useState<{ notaNo: string; rows: TransactionRecord[] } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadProofImage(file);
      if (url) {
        setField("proofLink", url);
      } else {
        alert("Gagal mengunggah foto. Silakan coba lagi.");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  const material = useMemo(() => getMaterial(materials, form.materialName), [materials, form.materialName]);
  const siteOrder = useMemo(
    () => getSiteOrder(deliveryOrders, form.siteName, form.materialName),
    [deliveryOrders, form.siteName, form.materialName],
  );
  const warehouse = useMemo(() => getWarehouse(master, form.whGci), [master, form.whGci]);
  const siteOptions = useMemo(() => deriveSiteOptions(deliveryOrders, sites), [deliveryOrders, sites]);
  const groupedMaterials = useMemo(() => {
    const groups: Record<string, string[]> = {};
    materials.forEach((m) => {
      const type = normalizeText(m.typeMaterial) || "Other";
      const name = normalizeText(m.materialName);
      if (name) {
        if (!groups[type]) groups[type] = [];
        if (!groups[type].includes(name)) groups[type].push(name);
      }
    });
    return groups;
  }, [materials]);
  
  const availableReels = useMemo(() => {
    const allRows = [...logRows, ...leftoverRows, ...tempRows];
    return getAvailableReels(form.materialName, form.whGci, form.taggingType, allRows);
  }, [form.materialName, form.whGci, form.taggingType, logRows, leftoverRows, tempRows]);

  const liveValidation = validateForm(form, materials, inventory);

  const setField = <K extends keyof TransactionFormState>(field: K, value: TransactionFormState[K]) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "transactionType" || field === "whGci" || field === "date") {
         if (next.transactionType && next.whGci && next.date) {
            const allRows = [...logRows, ...leftoverRows, ...tempRows];
            next.notaNo = generateNotaNo(next.transactionType, next.whGci, master.warehouses, allRows, next.date);
         } else {
            next.notaNo = "";
         }
      }
      return next;
    });
  };

  const handleInput = () => {
    setSubmitted(true);
    if (liveValidation.errors.length > 0) return;
    const nextLine = tempRows.reduce((max, row) => Math.max(max, Number(row.lineId) || 0), 0) + 1;
    const allRows = [...logRows, ...leftoverRows, ...tempRows];
    
    const sign = movementSign(form.transactionType);
    const isCable = material?.unit?.toUpperCase() === "METER";

    if (isCable && sign > 0) {
      const reelSize = Number(form.haspelSize) || 3000;
      const qty = Number(form.qty) || 0;
      const numReels = Math.ceil(qty / reelSize);
      
      const dateObj = form.date ? new Date(form.date) : new Date();
      const dateStr = `${String(dateObj.getFullYear()).slice(-2)}${String(dateObj.getMonth()+1).padStart(2,"0")}${String(dateObj.getDate()).padStart(2,"0")}`;
      const namePart = (material?.materialName || "CAB").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const prefix = `H-${namePart}-${dateStr}-`;
      
      let maxSeq = 0;
      for (const r of allRows) {
        if (r.drumNumber?.startsWith(prefix)) {
           const seq = Number(r.drumNumber.slice(prefix.length));
           if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq);
        }
      }
      
      let remaining = qty;
      let currentLine = nextLine;
      for (let i = 0; i < numReels; i++) {
         const take = Math.min(remaining, reelSize);
         if (take <= 0) break;
         maxSeq++;
         const reelId = `${prefix}${String(maxSeq).padStart(3, "0")}`;
         
         const row = makeTempRecord({...form, qty: String(take), drumNumber: reelId}, currentLine, master, materials, deliveryOrders, allRows);
         onAddTemp(row);
         currentLine++;
         remaining -= take;
      }
    } else if (isCable && sign < 0) {
       const qty = Number(form.qty) || 0;
       let availableReelsList = getAvailableReels(form.materialName, form.whGci, form.taggingType, allRows);
       
       if (form.drumNumber) {
          availableReelsList = availableReelsList.filter(r => r.drumNumber === form.drumNumber);
       }
       
       let remaining = qty;
       let currentLine = nextLine;
       
       for (const reel of availableReelsList) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, reel.remaining);
          
          const row = makeTempRecord({...form, qty: String(take), drumNumber: reel.drumNumber}, currentLine, master, materials, deliveryOrders, allRows);
          onAddTemp(row);
          currentLine++;
          remaining -= take;
       }
       
       if (remaining > 0) {
          alert(`Stok Haspel/Reel tidak cukup untuk material ini. Sisa kurang: ${formatNumber(remaining)} Meter. Input dibatalkan sebagian/seluruhnya.`);
       }
    } else {
       const row = makeTempRecord(form, nextLine, master, materials, deliveryOrders, allRows);
       onAddTemp(row);
    }

    setSubmitted(false);
    setForm((current) => ({
      ...current,
      notaNo: current.notaNo,
      qty: "",
      remarks: "",
      materialName: "",
      drumNumber: "",
    }));
  };

  const handleProcess = () => {
    if (tempRows.length === 0) return;
    const currentNota = tempRows[0].notaNo;
    const currentRows = [...tempRows];
    onProcess(processTempRows(tempRows, logRows, leftoverRows, master));
    setReceiptData({ notaNo: currentNota || "N/A", rows: currentRows });
  };

  const handleResetForm = () => {
    setForm(defaultForm(master, defaultWarehouse));
    setSubmitted(false);
  };

  const getBadgeClass = (txType: string) => {
    const t = (txType || "").toUpperCase();
    if (t.includes("INBOUND")) return "badge-inbound";
    if (t.includes("OUTBOUND")) return "badge-outbound";
    if (t.includes("BORROW")) return "badge-borrow";
    if (t.includes("TRANSFER")) return "badge-transfer";
    if (t.includes("RETURN")) return "badge-return";
    return "";
  };

  const filteredTxTypes = useMemo(() => {
    return master.transactionTypes.filter((type) => {
      if (!transactionGroup) return true;
      const upper = type.toUpperCase();
      if (transactionGroup === "INBOUND") return upper.includes("INBOUND");
      if (transactionGroup === "OUTBOUND") return upper.includes("OUTBOUND");
      if (transactionGroup === "TRANSFER") return upper.includes("TRANSFER");
      if (transactionGroup === "BORROW") return upper.includes("BORROW") || upper.includes("RETURN");
      return true;
    });
  }, [master.transactionTypes, transactionGroup]);

  const filteredSources = useMemo(() => {
    if (transactionGroup === "BORROW") {
      return master.sources.filter(s => s.toLowerCase().includes("other subcon"));
    }
    return master.sources;
  }, [master.sources, transactionGroup]);

  useEffect(() => {
    if (filteredTxTypes.length === 1 && form.transactionType !== filteredTxTypes[0]) {
      setField("transactionType", filteredTxTypes[0]);
    }
    if (filteredSources.length === 1 && form.sourceDestination !== filteredSources[0]) {
      setField("sourceDestination", filteredSources[0]);
    }
  }, [filteredTxTypes, filteredSources, form.transactionType, form.sourceDestination]);

  useEffect(() => {
    if (defaultWarehouse && defaultWarehouse !== "ALL" && form.whGci !== defaultWarehouse && tempRows.length === 0) {
      setField("whGci", defaultWarehouse);
    }
  }, [defaultWarehouse]);

  return (
    <div className="page active" id="page-transaksi">
      <div className="alert alert-info">
        <Info size={16} />
        <span>Langkah: (1) Isi Header Transaksi → (2) Isi Detail Material, klik <b>+ Tambah ke Nota</b> untuk tiap item → (3) Review Temporary Table → (4) Klik <b>Proses ke Logfile</b></span>
      </div>

      {form.notaNo && (
        <div className="nota-box">
          <div>
            <div className="nota-id">{form.notaNo}</div>
            <div className="nota-meta">{form.transactionType} · {form.date ? new Date(form.date + "T00:00:00").toLocaleDateString("id-ID") : ""} · {form.whGci}</div>
          </div>
          <span className={`badge ${getBadgeClass(form.transactionType)}`}>{form.transactionType || "NEW"}</span>
        </div>
      )}

      <div className="card">
        <div className="form-section">Header Transaksi</div>
        <div className="form-grid">
          {filteredTxTypes.length > 1 && (
            <div className="form-group">
              <label>Tipe Transaksi *</label>
              <select value={form.transactionType} onChange={(e) => setField("transactionType", e.target.value)} disabled={tempRows.length > 0}>
                <option value="">-- Pilih Tipe --</option>
                {filteredTxTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Nomor Nota (Auto-generate)</label>
            <input type="text" value={form.notaNo} readOnly placeholder="Pilih tipe transaksi dahulu" />
            <span className="form-hint">Format: PREFIX-WHIDYYMM-XXX</span>
          </div>
          <div className="form-group">
            <label>WH GCI</label>
            <select value={form.whGci} onChange={(e) => setField("whGci", e.target.value)} disabled={tempRows.length > 0}>
              <option value="">-- Pilih WH --</option>
              {master.warehouses.filter((wh) => wh.whGci).map((wh) => (
                <option key={wh.whGci ?? ""} value={wh.whGci ?? ""}>{wh.whGci}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tanggal *</label>
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} disabled={tempRows.length > 0} />
          </div>
          <div className="form-group">
            <label>Material Source / Destination *</label>
            <select value={form.sourceDestination} onChange={(e) => setField("sourceDestination", e.target.value)} disabled={tempRows.length > 0}>
              <option value="">-- Pilih --</option>
              {filteredSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>PIC Warehouse</label>
            <input type="text" value={warehouse?.picWh || ""} readOnly placeholder="Terisi otomatis dari Master" />
          </div>
        </div>

        <div className="form-section">Detail Material (per item)</div>
        <div className="form-grid-3">
          <div className="form-group">
            <label>Nama Material *</label>
            <select
              value={form.materialName}
              onChange={(e) => setField("materialName", e.target.value)}
            >
              <option value="">-- Pilih Material --</option>
              {Object.entries(groupedMaterials).map(([type, names]) => (
                <optgroup key={type} label={type}>
                  {names.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Kode Material (Auto)</label>
            <input type="text" value={material?.materialCode || ""} readOnly placeholder="—" />
          </div>
          <div className="form-group">
            <label>Unit (Auto)</label>
            <input type="text" value={material?.unit || ""} readOnly placeholder="—" />
          </div>
        </div>
        <div className="form-grid-3" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Qty *</label>
            <input type="number" value={form.qty} onChange={(e) => setField("qty", e.target.value)} placeholder="0" />
            <div className="form-hint">Stock WH: <b>{formatNumber(inventory.find((i) => i.materialName === material?.materialName)?.stockWhCalc ?? 0)}</b> {material?.unit}</div>
          </div>
          {material?.unit?.toUpperCase() === "METER" && movementSign(form.transactionType) > 0 && (
            <div className="form-group">
              <label>Haspel/Reel Size (Meter) *</label>
              <input type="text" value={form.haspelSize || ""} onChange={(e) => setField("haspelSize", e.target.value)} placeholder="3000" />
              <div className="form-hint">Otomatis dipecah per {form.haspelSize || 3000}m</div>
            </div>
          )}
          <div className="form-group">
            <label>Kondisi Material</label>
            <select value={form.condition} onChange={(e) => setField("condition", e.target.value)}>
              <option value="">— Pilih —</option>
              {master.conditions.map((condition) => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tagging Type</label>
            <select value={form.taggingType} onChange={(e) => setField("taggingType", e.target.value as any)}>
              <option value="LOGFILE">LOGFILE</option>
              <option value="LEFTOVERS">LEFTOVERS</option>
            </select>
          </div>
          {material?.unit?.toLowerCase() === "meter" && (
            <div className="form-group">
              <label>Drum Number / Haspel</label>
              {movementSign(form.transactionType) < 0 ? (
                <select value={form.drumNumber || ""} onChange={(e) => setField("drumNumber", e.target.value)}>
                  <option value="">-- Auto FIFO --</option>
                  {availableReels.map(r => (
                    <option key={r.drumNumber} value={r.drumNumber}>
                      {r.drumNumber} (Sisa: {formatNumber(r.remaining)}m)
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={form.drumNumber || ""} onChange={(e) => setField("drumNumber", e.target.value)} placeholder="Contoh: DN-12345" disabled={movementSign(form.transactionType) > 0} title={movementSign(form.transactionType) > 0 ? "Otomatis digenerate" : ""} />
              )}
            </div>
          )}
        </div>

        {transactionGroup !== "TRANSFER" && (
          <>
            <div className="form-section">Informasi Site</div>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Site Name</label>
                <input
                  list="wims-sites"
                  value={form.siteName}
                  onChange={(e) => setField("siteName", e.target.value)}
                  placeholder="Cari site"
                  disabled={tempRows.length > 0}
                />
                <datalist id="wims-sites">
                  {siteOptions.map((site) => (
                    <option key={site} value={site} />
                  ))}
                </datalist>
              </div>
              <div className="form-group">
                <label>Site ID (Auto)</label>
                <input type="text" value={siteOrder?.siteId || ""} readOnly placeholder="—" />
              </div>
              <div className="form-group">
                <label>Milestone Site (Auto)</label>
                <input type="text" value={sites.find(s => s.siteName === form.siteName)?.finalMilestone || ""} readOnly placeholder="—" style={{ fontSize: 11 }} />
              </div>
            </div>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <div className="form-group">
                <label>DO Number</label>
                <input type="text" value={form.doNumber || siteOrder?.doNumber || ""} onChange={(e) => setField("doNumber" as any, e.target.value)} placeholder="DOEID..." />
              </div>
              <div className="form-group">
                <label>DN Number</label>
                <input type="text" value={form.dnNumber || siteOrder?.dnNumber || ""} onChange={(e) => setField("dnNumber" as any, e.target.value)} placeholder="DNWID..." />
              </div>
            </div>
          </>
        )}

        <div className="form-section">Informasi Pengiriman (Opsional)</div>
        <div className="form-grid">
          <div className="form-group">
            <label>PIC Delivery</label>
            <input type="text" value={form.picDelivery} onChange={(e) => setField("picDelivery", e.target.value)} placeholder="Nama PIC pengiriman" disabled={tempRows.length > 0} />
          </div>
          <div className="form-group">
            <label>Vendor / Supplier</label>
            <input type="text" value={form.vendorSupplier} onChange={(e) => setField("vendorSupplier", e.target.value)} placeholder="Nama vendor" disabled={tempRows.length > 0} />
          </div>
          <div className="form-group">
            <label>No. ID Card (KTP)</label>
            <input type="text" value={form.idCard} onChange={(e) => setField("idCard", e.target.value)} placeholder="16 digit KTP" disabled={tempRows.length > 0} />
          </div>
          <div className="form-group">
            <label>Nomor Polisi Kendaraan</label>
            <input type="text" value={form.carPlate} onChange={(e) => setField("carPlate", e.target.value)} placeholder="cth: B 1234 XY" disabled={tempRows.length > 0} />
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Keterangan / Remarks</label>
            <textarea rows={2} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} placeholder="Catatan tambahan..."></textarea>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span>Bukti Foto / GDrive</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 11 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Camera size={12} />
                {isUploading ? "Mengunggah..." : "Ambil Foto"}
              </button>
            </label>
            <input type="url" value={form.proofLink || ""} onChange={(e) => setField("proofLink", e.target.value)} placeholder="Atau paste link file di sini..." disabled={isUploading} />
          </div>
        </div>

        {submitted && liveValidation.errors.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {liveValidation.errors.map((error) => (
              <div className="alert alert-danger" key={error}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={handleResetForm}>
            <RefreshCcw size={16} style={{ marginRight: 6 }} /> Bersihkan Form
          </button>
          <button type="button" className="btn btn-primary" onClick={handleInput}>
            <Plus size={16} style={{ marginRight: 6 }} /> Tambah ke Nota
          </button>
        </div>
      </div>

      <div className="temp-panel">
        <div className="temp-panel-header">
          <div>
            <div className="temp-panel-title">📋 Temporary Table — Preview Nota</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Review data sebelum diproses ke Logfile</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={onClearTemp} disabled={tempRows.length === 0}>🗑 Hapus Semua</button>
            <button type="button" className="btn btn-sm" style={{ fontSize: 12, padding: "5px 10px" }} onClick={onPrintNota} disabled={tempRows.length === 0}>🖨 Print Nota</button>
            <button type="button" className="btn btn-success btn-sm" onClick={handleProcess} disabled={tempRows.length === 0}>✓ Proses ke Logfile</button>
          </div>
        </div>
        <div id="temp-content" className="table-wrap">
          {tempRows.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Belum ada item. Isi form di atas dan klik "+ Tambah ke Nota".</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Tagging</th>
                  <th>Transaksi</th>
                  <th>Nota No.</th>
                  <th>Material</th>
                  <th>Drum Number / Haspel</th>
                  <th>Site Name</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th>Unit</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tempRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.lineId}</td>
                    <td>
                      <span className={`badge ${row.taggingType === "LEFTOVERS" ? "badge-return" : "badge-inbound"}`}>
                        {row.taggingType}
                      </span>
                    </td>
                    <td>{row.transactionType}</td>
                    <td className="mono">{row.notaNo}</td>
                    <td>{row.materialName}</td>
                    <td style={{ fontSize: 12, color: "var(--blue)" }}>{row.drumNumber || "-"}</td>
                    <td>{row.siteName || "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatNumber(row.qty)}</td>
                    <td>{row.unit}</td>
                    <td>
                      <button type="button" className="btn btn-sm" style={{ padding: 4 }} title="Remove row" onClick={() => onRemoveTemp(row.id)}>
                        <Trash2 size={14} color="var(--red)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      
      {receiptData && (
        <ReceiptModal
          notaNo={receiptData.notaNo}
          rows={receiptData.rows}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}
