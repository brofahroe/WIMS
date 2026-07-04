import { AlertTriangle, Info, Play, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
} from "../lib/wims";

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
}

function defaultForm(master: MasterData): TransactionFormState {
  const firstWh = master.warehouses.find((item) => item.whGci && item.whGci !== "ALL")?.whGci ?? "";
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
}: TransactionWorkspaceProps) {
  const [form, setForm] = useState<TransactionFormState>(() => defaultForm(master));
  const [submitted, setSubmitted] = useState(false);
  
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
    const row = makeTempRecord(form, nextLine, master, materials, deliveryOrders, [...logRows, ...leftoverRows, ...tempRows]);
    onAddTemp(row);
    setSubmitted(false);
    setForm((current) => ({
      ...current,
      notaNo: row.notaNo ?? current.notaNo,
      qty: "",
      remarks: "",
      materialName: "",
      drumNumber: "",
    }));
  };

  const handleProcess = () => {
    if (tempRows.length === 0) return;
    onProcess(processTempRows(tempRows, logRows, leftoverRows, master));
  };

  const handleResetForm = () => {
    setForm(defaultForm(master));
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
          <div className="form-group">
            <label>Tipe Transaksi *</label>
            <select value={form.transactionType} onChange={(e) => setField("transactionType", e.target.value)}>
              <option value="">-- Pilih Tipe --</option>
              {master.transactionTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Nomor Nota (Auto-generate)</label>
            <input type="text" value={form.notaNo} readOnly placeholder="Pilih tipe transaksi dahulu" />
            <span className="form-hint">Format: PREFIX-WHIDYYMM-XXX</span>
          </div>
          <div className="form-group">
            <label>WH GCI</label>
            <select value={form.whGci} onChange={(e) => setField("whGci", e.target.value)}>
              <option value="">-- Pilih WH --</option>
              {master.warehouses.filter((wh) => wh.whGci).map((wh) => (
                <option key={wh.whGci ?? ""} value={wh.whGci ?? ""}>{wh.whGci}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Tanggal *</label>
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Material Source / Destination *</label>
            <select value={form.sourceDestination} onChange={(e) => setField("sourceDestination", e.target.value)}>
              <option value="">-- Pilih --</option>
              {master.sources.map((source) => (
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
            <input min="0" step="0.01" type="number" value={form.qty} onChange={(e) => setField("qty", e.target.value)} placeholder="0" />
          </div>
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
              <label>Drum Number (Opsional)</label>
              <input type="text" value={form.drumNumber || ""} onChange={(e) => setField("drumNumber", e.target.value)} placeholder="Contoh: DN-12345" />
            </div>
          )}
        </div>

        <div className="form-section">Informasi Site</div>
        <div className="form-grid-3">
          <div className="form-group">
            <label>Site Name</label>
            <input
              list="wims-sites"
              value={form.siteName}
              onChange={(e) => setField("siteName", e.target.value)}
              placeholder="Cari site"
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

        <div className="form-section">Informasi Pengiriman (Opsional)</div>
        <div className="form-grid">
          <div className="form-group">
            <label>PIC Delivery</label>
            <input type="text" value={form.picDelivery} onChange={(e) => setField("picDelivery", e.target.value)} placeholder="Nama PIC pengiriman" />
          </div>
          <div className="form-group">
            <label>Vendor / Supplier</label>
            <input type="text" value={form.vendorSupplier} onChange={(e) => setField("vendorSupplier", e.target.value)} placeholder="Nama vendor" />
          </div>
          <div className="form-group">
            <label>No. ID Card (KTP)</label>
            <input type="text" value={form.idCard} onChange={(e) => setField("idCard", e.target.value)} placeholder="16 digit KTP" />
          </div>
          <div className="form-group">
            <label>Nomor Polisi Kendaraan</label>
            <input type="text" value={form.carPlate} onChange={(e) => setField("carPlate", e.target.value)} placeholder="cth: B 1234 XY" />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: 12 }}>
          <label>Keterangan / Remarks</label>
          <textarea rows={2} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} placeholder="Catatan tambahan..."></textarea>
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
    </div>
  );
}
