import { Download, Search, Plus, Edit2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { DeliveryOrder, MasterData, TransactionRecord } from "../types";
import { compareText, normalizeText, asDateInput } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";
import { Modal } from "./ui/Modal";
import { supabase } from "../lib/supabase";

interface DeliveryOrdersProps {
  orders: DeliveryOrder[];
  master: MasterData;
  logRows: TransactionRecord[];
  onRefresh?: () => void;
}

export function DeliveryOrders({ orders, master, logRows, onRefresh }: DeliveryOrdersProps) {
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliveryOrder | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<DeliveryOrder>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();
    if (!normalizedQuery) return orders;
    return orders.filter((o) => {
      return [o.doNumber, o.dnNumber, o.siteId, o.siteName, o.materialName]
        .some((val) => normalizeText(val).toLowerCase().includes(normalizedQuery));
    });
  }, [query, orders]);

  const { items: sortedOrders, requestSort, sortConfig } = useSortableData(filtered);

  const handleOpenModal = (order?: DeliveryOrder) => {
    if (order) {
      setEditingItem(order);
      setFormData(order);
    } else {
      setEditingItem(null);
      setFormData({
        doNumber: "", dnNumber: "", siteId: "", siteName: "", 
        subcon: "", region: "", city: "", dropCity: "", materialName: "", qty: 0, materialPickUpdate: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Convert qty to number
    const payload = { ...formData, qty: Number(formData.qty) || 0 };

    const { error } = await supabase.from("delivery_orders").upsert(payload);
    
    setIsSaving(false);
    if (error) {
      alert("Gagal menyimpan data DO: " + error.message);
    } else {
      setIsModalOpen(false);
      onRefresh && onRefresh();
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Yakin ingin menghapus Delivery Order ini?")) return;
    
    const { error } = await supabase.from("delivery_orders").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus data: " + error.message);
    } else {
      onRefresh && onRefresh();
    }
  };

  const handleExportCsv = () => {
    const headers = ["DO Number", "DN Number", "Site Name", "Material Name", "Qty", "Pick Update", "Sync Status"];
    const rows = filtered.map(o => {
      const inboundTx = logRows.find((tx) => compareText(tx.transactionType, "INBOUND") && compareText(tx.doNumber, o.doNumber) && compareText(tx.materialName, o.materialName));
      const inDate = inboundTx ? asDateInput(inboundTx.date) : null;
      const pickDate = o.materialPickUpdate ? asDateInput(o.materialPickUpdate) : null;
      let status = "No Inbound";
      if (inboundTx && pickDate === inDate) status = "Synchronized";
      else if (inboundTx) status = "Mismatch";

      return [
        `"${o.doNumber || ""}"`,
        `"${o.dnNumber || ""}"`,
        `"${o.siteName || ""}"`,
        `"${o.materialName || ""}"`,
        o.qty || 0,
        `"${o.materialPickUpdate || ""}"`,
        `"${status}"`
      ];
    });
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "WIMS_Delivery_Orders.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page active" id="page-do">
      <div className="filters-bar" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="search-field" style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Cari DO, DN, Site, atau Material..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ paddingLeft: 34, width: "100%", height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <button className="btn" onClick={handleExportCsv} style={{ height: 36 }}>
          <Download size={16} style={{ marginRight: 6 }} /> Export CSV
        </button>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ height: 36 }}>
          <Plus size={16} style={{ marginRight: 6 }} /> Tambah DO
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortableHeader label="DO Number" sortKey="doNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="DN Number" sortKey="dnNumber" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site Name" sortKey="siteName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Qty" sortKey="qty" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Pick Update" sortKey="materialPickUpdate" currentSort={sortConfig} requestSort={requestSort} />
                <th>Status</th>
                <th style={{ width: 80, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map((o) => {
                const inboundTx = logRows.find((tx) => compareText(tx.transactionType, "INBOUND") && compareText(tx.doNumber, o.doNumber) && compareText(tx.materialName, o.materialName));
                const inDate = inboundTx ? asDateInput(inboundTx.date) : null;
                const pickDate = o.materialPickUpdate ? asDateInput(o.materialPickUpdate) : null;
                
                let syncBadge = <span className="badge" style={{ background: "var(--border)", color: "var(--text2)" }}>No Inbound</span>;
                if (inboundTx && pickDate === inDate) {
                  syncBadge = <span className="badge" style={{ background: "var(--success)", color: "white" }}>Synchronized</span>;
                } else if (inboundTx) {
                  syncBadge = <span className="badge" style={{ background: "var(--red)", color: "white" }}>Mismatch ({inDate})</span>;
                }

                return (
                  <tr key={o.id}>
                    <td className="mono">{o.doNumber}</td>
                    <td className="mono">{o.dnNumber}</td>
                    <td>{o.siteName}</td>
                    <td>{o.materialName}</td>
                    <td className="numeric">{o.qty}</td>
                    <td>{o.materialPickUpdate ? asDateInput(o.materialPickUpdate) : "-"}</td>
                    <td>{syncBadge}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--blue)", marginRight: 6 }} onClick={() => handleOpenModal(o)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--red)" }} onClick={() => handleDelete(o.id)} title="Hapus">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada Delivery Order yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div id="do-count" style={{ fontSize: 12, color: "var(--text3)", marginTop: 12, textAlign: "right" }}>
        Menampilkan {filtered.length} dari {orders.length} DO
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Delivery Order" : "Tambah Delivery Order"}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label>DO Number</label>
              <input required value={formData.doNumber || ""} onChange={e => setFormData({...formData, doNumber: e.target.value})} />
            </div>
            <div className="form-group">
              <label>DN Number</label>
              <input value={formData.dnNumber || ""} onChange={e => setFormData({...formData, dnNumber: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Site ID</label>
              <input value={formData.siteId || ""} onChange={e => setFormData({...formData, siteId: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Site Name</label>
              <input required value={formData.siteName || ""} onChange={e => setFormData({...formData, siteName: e.target.value})} />
            </div>
            <div className="form-group span-2">
              <label>Material Name</label>
              <input required value={formData.materialName || ""} onChange={e => setFormData({...formData, materialName: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Qty</label>
              <input type="number" required value={formData.qty || ""} onChange={e => setFormData({...formData, qty: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label>Pick Update (Date)</label>
              <input type="date" value={formData.materialPickUpdate ? asDateInput(formData.materialPickUpdate) : ""} onChange={e => setFormData({...formData, materialPickUpdate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input value={formData.city || ""} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
