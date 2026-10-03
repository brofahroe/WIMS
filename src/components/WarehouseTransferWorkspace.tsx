import { ArrowLeftRight, Check, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MasterData, MaterialItem, TransactionRecord, User, WarehouseOption, WarehouseTransfer, WarehouseTransferLine } from "../types";
import { canAccessWarehouse, formatNumber, generateNotaNo, getMaterial } from "../lib/wims";
import { dispatchWarehouseTransfer, receiveWarehouseTransfer, resolveWarehouseTransferLine } from "../lib/supabase";

interface WarehouseTransferWorkspaceProps {
  master: MasterData;
  materials: MaterialItem[];
  logRows: TransactionRecord[];
  transfers: WarehouseTransfer[];
  transferLines: WarehouseTransferLine[];
  sourceWarehouses: WarehouseOption[];
  destinationWarehouses: WarehouseOption[];
  currentUser: User;
  onRefresh: () => Promise<void>;
}

interface LineActions {
  receiveQty: string;
  receiveRemarks: string;
  returnQty: string;
  writeOffQty: string;
  resolutionReason: string;
}

export function WarehouseTransferWorkspace({
  master,
  materials,
  logRows,
  transfers,
  transferLines,
  sourceWarehouses,
  destinationWarehouses,
  currentUser,
  onRefresh,
}: WarehouseTransferWorkspaceProps) {
  const [sourceWarehouseGci, setSourceWarehouseGci] = useState(sourceWarehouses[0]?.whGci ?? "");
  const [destinationWarehouseGci, setDestinationWarehouseGci] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [qty, setQty] = useState("");
  const [drumNumber, setDrumNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [lineActions, setLineActions] = useState<Record<string, LineActions>>({});
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const material = useMemo(() => getMaterial(materials, materialName), [materials, materialName]);
  const notaNo = useMemo(
    () => sourceWarehouseGci && date
      ? generateNotaNo("TRANSFER OUT", sourceWarehouseGci, master.warehouses, logRows, date)
      : "",
    [sourceWarehouseGci, date, master.warehouses, logRows],
  );

  useEffect(() => {
    if (!sourceWarehouses.some((warehouse) => warehouse.whGci === sourceWarehouseGci)) {
      setSourceWarehouseGci(sourceWarehouses[0]?.whGci ?? "");
    }
  }, [sourceWarehouses, sourceWarehouseGci]);

  useEffect(() => {
    if (!destinationWarehouses.some((warehouse) => warehouse.whGci === destinationWarehouseGci) || destinationWarehouseGci === sourceWarehouseGci) {
      setDestinationWarehouseGci(destinationWarehouses.find((warehouse) => warehouse.whGci !== sourceWarehouseGci)?.whGci ?? "");
    }
  }, [destinationWarehouses, destinationWarehouseGci, sourceWarehouseGci]);

  const getActions = (lineId: string, outstanding: number): LineActions => lineActions[lineId] ?? {
    receiveQty: String(outstanding),
    receiveRemarks: "",
    returnQty: String(outstanding),
    writeOffQty: "0",
    resolutionReason: "",
  };

  const updateActions = (lineId: string, updates: Partial<LineActions>, outstanding: number) => {
    setLineActions((current) => ({
      ...current,
      [lineId]: { ...getActions(lineId, outstanding), ...updates },
    }));
  };

  const handleDispatch = async () => {
    if (!material || !sourceWarehouseGci || !destinationWarehouseGci || sourceWarehouseGci === destinationWarehouseGci || Number(qty) <= 0) return;
    setIsDispatching(true);
    setError(null);
    try {
      await dispatchWarehouseTransfer({
        notaNo,
        sourceWarehouseGci,
        destinationWarehouseGci,
        materialName,
        qty: Number(qty),
        unit: material.unit ?? "",
        drumNumber,
        date,
        remarks,
      });
      setQty("");
      setDrumNumber("");
      setRemarks("");
      await onRefresh();
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : "Gagal mengirim transfer.");
    } finally {
      setIsDispatching(false);
    }
  };

  const handleReceive = async (line: WarehouseTransferLine, outstanding: number) => {
    const actions = getActions(line.id, outstanding);
    const receivedQty = Number(actions.receiveQty);
    if (!Number.isFinite(receivedQty) || receivedQty <= 0 || receivedQty > outstanding) {
      setError("Jumlah penerimaan harus lebih dari nol dan tidak boleh melebihi sisa transfer.");
      return;
    }
    setBusyLineId(line.id);
    setError(null);
    try {
      await receiveWarehouseTransfer(line.id, receivedQty, actions.receiveRemarks);
      await onRefresh();
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : "Gagal mengonfirmasi penerimaan.");
    } finally {
      setBusyLineId(null);
    }
  };

  const handleResolve = async (line: WarehouseTransferLine, outstanding: number) => {
    const actions = getActions(line.id, outstanding);
    const returnedQty = Number(actions.returnQty);
    const writtenOffQty = Number(actions.writeOffQty);
    if (!actions.resolutionReason.trim() || !Number.isFinite(returnedQty) || !Number.isFinite(writtenOffQty) || returnedQty < 0 || writtenOffQty < 0 || returnedQty + writtenOffQty !== outstanding) {
      setError("Jumlah dikembalikan dan disesuaikan harus sama dengan sisa transfer, dengan alasan wajib.");
      return;
    }
    setBusyLineId(line.id);
    setError(null);
    try {
      await resolveWarehouseTransferLine(line.id, returnedQty, writtenOffQty, actions.resolutionReason);
      await onRefresh();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Gagal menyelesaikan sisa transfer.");
    } finally {
      setBusyLineId(null);
    }
  };

  const activeTransfers = transfers.filter((transfer) => transfer.status === "IN_TRANSIT" || transfer.status === "PARTIALLY_RECEIVED");
  const lineByTransfer = new Map(transferLines.map((line) => [line.transferId, line]));

  return (
    <div className="page active" id="page-transfers">
      <div className="two-col" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="form-section">Kirim Antar Gudang</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Gudang Asal *</label>
              <select value={sourceWarehouseGci} onChange={(event) => setSourceWarehouseGci(event.target.value)}>
                <option value="">Pilih gudang asal</option>
                {sourceWarehouses.map((warehouse) => <option key={warehouse.whGci} value={warehouse.whGci ?? ""}>{warehouse.whGci}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Gudang Tujuan *</label>
              <select value={destinationWarehouseGci} onChange={(event) => setDestinationWarehouseGci(event.target.value)}>
                <option value="">Pilih gudang tujuan</option>
                {destinationWarehouses.filter((warehouse) => warehouse.whGci !== sourceWarehouseGci).map((warehouse) => <option key={warehouse.whGci} value={warehouse.whGci ?? ""}>{warehouse.whGci}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nota Transfer</label>
              <input value={notaNo} readOnly />
            </div>
            <div className="form-group">
              <label>Tanggal *</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Material *</label>
              <select value={materialName} onChange={(event) => setMaterialName(event.target.value)}>
                <option value="">Pilih material</option>
                {materials.map((item) => <option key={item.materialName} value={item.materialName ?? ""}>{item.materialName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Jumlah * {material?.unit ? `(${material.unit})` : ""}</label>
              <input type="number" min="0" step="any" value={qty} onChange={(event) => setQty(event.target.value)} />
            </div>
            {material?.unit?.toUpperCase() === "METER" && (
              <div className="form-group">
                <label>Nomor Drum / Haspel</label>
                <input value={drumNumber} onChange={(event) => setDrumNumber(event.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label>Keterangan</label>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={handleDispatch} disabled={isDispatching || !material || !destinationWarehouseGci || Number(qty) <= 0 || currentUser.role === "Manager"}>
              <Send size={15} style={{ marginRight: 6 }} />
              {isDispatching ? "Mengirim..." : "Kirim Transfer"}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="form-section">Transfer Dalam Perjalanan</div>
          {activeTransfers.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Tidak ada transfer yang menunggu penyelesaian.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nota</th><th>Rute</th><th>Material</th><th>Status</th><th style={{ textAlign: "right" }}>Sisa</th></tr>
                </thead>
                <tbody>
                  {activeTransfers.map((transfer) => {
                    const line = lineByTransfer.get(transfer.id);
                    if (!line) return null;
                    const outstanding = Math.max(0, line.qtySent - line.qtyReceived - line.qtyReturned - line.qtyWrittenOff);
                    const actions = getActions(line.id, outstanding);
                    const canReceive = currentUser.role === "Admin" || (currentUser.role === "Staff Gudang" && canAccessWarehouse(currentUser, transfer.destinationWarehouseGci));
                    const canResolve = currentUser.role === "Admin" || (currentUser.role === "Staff Gudang" && canAccessWarehouse(currentUser, transfer.sourceWarehouseGci));
                    return (
                      <tr key={transfer.id}>
                        <td className="mono">{transfer.notaNo}</td>
                        <td>{transfer.sourceWarehouseGci} → {transfer.destinationWarehouseGci}</td>
                        <td>{line.materialName} · {formatNumber(line.qtyReceived)}/{formatNumber(line.qtySent)} {line.qtySent ? materials.find((item) => item.materialName === line.materialName)?.unit : ""}</td>
                        <td>{transfer.status === "PARTIALLY_RECEIVED" ? "Diterima sebagian" : "Dalam perjalanan"}</td>
                        <td className="numeric">{formatNumber(outstanding)}</td>
                        <td>
                          {canReceive && (
                            <div className="form-grid" style={{ minWidth: 220 }}>
                              <input aria-label="Jumlah diterima" type="number" min="0" max={outstanding} step="any" value={actions.receiveQty} onChange={(event) => updateActions(line.id, { receiveQty: event.target.value }, outstanding)} />
                              <input aria-label="Catatan penerimaan" placeholder="Catatan penerimaan" value={actions.receiveRemarks} onChange={(event) => updateActions(line.id, { receiveRemarks: event.target.value }, outstanding)} />
                              <button type="button" className="btn btn-sm btn-success" onClick={() => handleReceive(line, outstanding)} disabled={busyLineId === line.id || outstanding <= 0}>
                                <Check size={14} style={{ marginRight: 4 }} /> Terima
                              </button>
                            </div>
                          )}
                          {canResolve && (
                            <details style={{ marginTop: 8 }}>
                              <summary>Selesaikan sisa</summary>
                              <div className="form-grid" style={{ minWidth: 220, marginTop: 8 }}>
                                <input aria-label="Jumlah dikembalikan" type="number" min="0" max={outstanding} step="any" value={actions.returnQty} onChange={(event) => updateActions(line.id, { returnQty: event.target.value }, outstanding)} placeholder="Dikembalikan" />
                                <input aria-label="Jumlah hilang atau rusak" type="number" min="0" max={outstanding} step="any" value={actions.writeOffQty} onChange={(event) => updateActions(line.id, { writeOffQty: event.target.value }, outstanding)} placeholder="Hilang/rusak" />
                                <input aria-label="Alasan penyelesaian" value={actions.resolutionReason} onChange={(event) => updateActions(line.id, { resolutionReason: event.target.value }, outstanding)} placeholder="Alasan wajib" />
                                <button type="button" className="btn btn-sm" onClick={() => handleResolve(line, outstanding)} disabled={busyLineId === line.id || outstanding <= 0}>Simpan Penyelesaian</button>
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {error && <div className="alert alert-danger" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      <div className="alert alert-info" style={{ marginTop: 16 }}>
        <ArrowLeftRight size={16} />
        <span>Stok tujuan bertambah setelah penerimaan dikonfirmasi. Sisa barang tetap dilacak sampai diterima atau diselesaikan oleh gudang asal.</span>
      </div>
    </div>
  );
}