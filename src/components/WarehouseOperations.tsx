import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MasterData, MaterialItem, OpeningBalanceRecord, User } from "../types";
import { formatNumber, getAccessibleWarehouses } from "../lib/wims";
import {
  approveWarehouseStatus,
  assignUserToWarehouse,
  createOpeningBalance,
  getWarehouseAssignments,
  removeWarehouseAssignment,
  proposeWarehouseStatus,
  verifyOpeningBalance,
  type WarehouseAssignment,
} from "../lib/supabase";

interface WarehouseOperationsProps {
  master: MasterData;
  materials: MaterialItem[];
  openings: OpeningBalanceRecord[];
  currentUser: User;
  onRefresh: () => Promise<void>;
}

export function WarehouseOperations({ master, materials, openings, currentUser, onRefresh }: WarehouseOperationsProps) {
  const availableWarehouses = useMemo(
    () => getAccessibleWarehouses(master.warehouses, currentUser),
    [master.warehouses, currentUser],
  );
  const [warehouseGci, setWarehouseGci] = useState(availableWarehouses[0]?.whGci ?? "");
  const [materialName, setMaterialName] = useState("");
  const [qty, setQty] = useState("");
  const [taggingType, setTaggingType] = useState<"LOGFILE" | "LEFTOVERS">("LOGFILE");
  const [drumNumber, setDrumNumber] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assignments, setAssignments] = useState<WarehouseAssignment[]>([]);
  const [assignedUserId, setAssignedUserId] = useState("");
  const [assignmentWarehouse, setAssignmentWarehouse] = useState(availableWarehouses[0]?.whGci ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const canManageAssignments = currentUser.role === "Admin" || currentUser.role === "Manager";
  const selectedWarehouse = master.warehouses.find((warehouse) => warehouse.whGci === warehouseGci);

  useEffect(() => {
    if (!availableWarehouses.some((warehouse) => warehouse.whGci === warehouseGci)) {
      setWarehouseGci(availableWarehouses[0]?.whGci ?? "");
    }
  }, [availableWarehouses, warehouseGci]);

  useEffect(() => {
    if (!canManageAssignments) return;
    getWarehouseAssignments().then(setAssignments).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat penugasan gudang.");
    });
  }, [canManageAssignments]);

  const runAction = async (action: () => Promise<void>) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      await onRefresh();
      if (canManageAssignments) setAssignments(await getWarehouseAssignments());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Operasi gudang gagal.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateOpening = () => {
    if (!warehouseGci || !materialName || !Number.isFinite(Number(qty)) || Number(qty) < 0 || !effectiveDate) return;
    void runAction(async () => {
      await createOpeningBalance({ warehouseGci, materialName, qty: Number(qty), taggingType, drumNumber, effectiveDate });
      setQty("");
      setDrumNumber("");
    });
  };

  return (
    <div className="page active" id="page-warehouse-operations">
      <div className="two-col" style={{ alignItems: "start" }}>
        <section className="card">
          {currentUser.role !== "Manager" && <>
          <div className="form-section">Stok Awal Gudang</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Gudang *</label>
              <select value={warehouseGci} onChange={(event) => setWarehouseGci(event.target.value)}>
                {availableWarehouses.map((warehouse) => <option key={warehouse.whGci} value={warehouse.whGci ?? ""}>{warehouse.whGci}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tanggal Efektif *</label>
              <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Material *</label>
              <select value={materialName} onChange={(event) => setMaterialName(event.target.value)}>
                <option value="">Pilih material</option>
                {materials.map((material) => <option key={material.materialName} value={material.materialName ?? ""}>{material.materialName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Jenis Stok *</label>
              <select value={taggingType} onChange={(event) => setTaggingType(event.target.value as "LOGFILE" | "LEFTOVERS")}>
                <option value="LOGFILE">Material Utuh</option>
                <option value="LEFTOVERS">Leftovers</option>
              </select>
            </div>
            <div className="form-group">
              <label>Jumlah *</label>
              <input type="number" min="0" step="any" value={qty} onChange={(event) => setQty(event.target.value)} />
            </div>
            <div className="form-group">
              <label>Drum / Haspel</label>
              <input value={drumNumber} onChange={(event) => setDrumNumber(event.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn btn-primary" onClick={handleCreateOpening} disabled={isBusy || !warehouseGci || !materialName || qty === ""}>
              <Plus size={15} style={{ marginRight: 6 }} /> Catat Hitung Fisik
            </button>
          </div>
          </>}
          <div className="form-section" style={{ marginTop: 24 }}>Hasil Hitung dan Pengesahan</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Gudang</th><th>Material</th><th>Jenis</th><th>Drum</th><th>Tanggal Efektif</th><th className="numeric">Jumlah</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {openings.filter((opening) => availableWarehouses.some((warehouse) => warehouse.whGci === opening.warehouseGci)).map((opening) => (
                  <tr key={opening.id}>
                    <td>{opening.warehouseGci}</td>
                    <td>{opening.materialName}</td>
                    <td>{opening.taggingType === "LEFTOVERS" ? "Leftovers" : "Utuh"}</td>
                    <td>{opening.drumNumber || "-"}</td>
                    <td>{opening.effectiveDate}</td>
                    <td className="numeric">{formatNumber(opening.qty)}</td>
                    <td>{opening.status === "VERIFIED" ? "Disahkan" : "Menunggu"}</td>
                    <td>
                      {opening.status === "PENDING" && canManageAssignments && (
                        <button type="button" className="btn btn-sm btn-success" title="Sahkan saldo awal" onClick={() => void runAction(() => verifyOpeningBalance(opening.id))} disabled={isBusy}>
                          <Check size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="form-section">Kesiapan Gudang</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Gudang</th><th>Status Operasi</th><th>Riwayat</th><th>Usulan</th><th>Aksi</th></tr></thead>
              <tbody>
                {availableWarehouses.map((warehouse) => (
                  <tr key={warehouse.whGci}>
                    <td>{warehouse.whGci}</td>
                    <td>{warehouse.operationalStatus === "OPERATIONAL" ? "Operasional" : "Persiapan"}</td>
                    <td>{warehouse.historyComplete ? "Lengkap" : "Belum lengkap"}</td>
                    <td>{warehouse.proposedOperationalStatus ? `${warehouse.proposedOperationalStatus === "OPERATIONAL" ? "Operasional" : "Persiapan"} / ${warehouse.proposedHistoryComplete ? "Riwayat lengkap" : "Riwayat belum lengkap"}` : "-"}</td>
                    <td>
                      {canManageAssignments && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button type="button" className="btn btn-sm" onClick={() => void runAction(() => proposeWarehouseStatus(warehouse.whGci ?? "", warehouse.operationalStatus === "OPERATIONAL" ? "OPERATIONAL" : "OPERATIONAL", warehouse.historyComplete ?? false))} disabled={isBusy || Boolean(warehouse.proposedOperationalStatus)}>
                            Usulkan Aktivasi
                          </button>
                          <button type="button" className="btn btn-sm" onClick={() => void runAction(() => proposeWarehouseStatus(warehouse.whGci ?? "", warehouse.operationalStatus ?? "SETUP", true))} disabled={isBusy || Boolean(warehouse.proposedOperationalStatus) || warehouse.historyComplete === true}>
                            Usulkan Riwayat Lengkap
                          </button>
                          {currentUser.role === "Admin" && warehouse.proposedOperationalStatus && (
                            <button type="button" className="btn btn-sm btn-success" onClick={() => void runAction(() => approveWarehouseStatus(warehouse.whGci ?? "", warehouse.proposedOperationalStatus === "OPERATIONAL" ? effectiveDate : null))} disabled={isBusy}>
                              Setujui
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManageAssignments && (
            <>
              <div className="form-section" style={{ marginTop: 24 }}>Penugasan Gudang</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>ID Pengguna *</label>
                  <input value={assignedUserId} onChange={(event) => setAssignedUserId(event.target.value.trim())} placeholder="UUID dari user_roles" />
                </div>
                <div className="form-group">
                  <label>Gudang *</label>
                  <select value={assignmentWarehouse} onChange={(event) => setAssignmentWarehouse(event.target.value)}>
                    {master.warehouses.filter((warehouse) => warehouse.whGci && warehouse.whGci !== "ALL" && warehouse.whGci !== "Dummy").map((warehouse) => <option key={warehouse.whGci} value={warehouse.whGci ?? ""}>{warehouse.whGci}</option>)}
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => void runAction(() => assignUserToWarehouse(assignedUserId, assignmentWarehouse))} disabled={isBusy || !assignedUserId || !assignmentWarehouse}>
                <Plus size={14} style={{ marginRight: 5 }} /> Tugaskan
              </button>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead><tr><th>ID Pengguna</th><th>Gudang</th><th></th></tr></thead>
                  <tbody>
                    {assignments.map((assignment) => (
                      <tr key={`${assignment.user_id}-${assignment.warehouse_gci}`}>
                        <td className="mono">{assignment.user_id}</td>
                        <td>{assignment.warehouse_gci}</td>
                        <td><button type="button" className="btn btn-sm" title="Hapus penugasan" onClick={() => void runAction(() => removeWarehouseAssignment(assignment.user_id, assignment.warehouse_gci))} disabled={isBusy}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
      {error && <div className="alert alert-danger" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      {selectedWarehouse?.historyComplete === false && (
        <div className="alert alert-warning" style={{ marginTop: 16 }}>
          Riwayat {selectedWarehouse.whGci} belum dinyatakan lengkap. Saldo opname terverifikasi tetap menjadi dasar stok berjalan.
        </div>
      )}
    </div>
  );
}