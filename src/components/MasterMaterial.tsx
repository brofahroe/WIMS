import { Download, Search, Plus, Edit2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { MaterialItem } from "../types";
import { normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";
import { Modal } from "./ui/Modal";
import { supabase } from "../lib/supabase";

interface MasterMaterialProps {
  materials: MaterialItem[];
  onMaterialClick?: (materialName: string) => void;
  onRefresh?: () => void;
}

export function MasterMaterial({ materials, onMaterialClick, onRefresh }: MasterMaterialProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MaterialItem | null>(null);
  const [formData, setFormData] = useState<Partial<MaterialItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      if (categoryFilter && item.typeMaterial !== categoryFilter) return false;
      if (searchTerm) {
        const query = normalizeText(searchTerm);
        const codeMatch = normalizeText(item.materialCode || "").includes(query);
        const nameMatch = normalizeText(item.materialName || "").includes(query);
        if (!codeMatch && !nameMatch) return false;
      }
      return true;
    });
  }, [materials, categoryFilter, searchTerm]);

  const { items: sortedMaterials, requestSort, sortConfig } = useSortableData(filteredMaterials);

  const handleExportCsv = () => {
    const headers = ["Kode", "Nama Material", "Tipe", "Sumber", "Unit", "Label Prefix"];
    const rows = filteredMaterials.map(m => [
      `"${m.materialCode || ""}"`,
      `"${m.materialName || ""}"`,
      `"${m.typeMaterial || ""}"`,
      `"${m.sourceMaterial || ""}"`,
      `"${m.unit || ""}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "WIMS_Master_Material.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenModal = (material?: MaterialItem) => {
    if (material) {
      setEditingItem(material);
      setFormData(material);
    } else {
      setEditingItem(null);
      setFormData({
        materialCode: "", materialName: "", typeMaterial: "", sourceMaterial: "", unit: "",
        inbound: 0, outbound: 0, transferIn: 0, transferOut: 0, borrowIn: 0, borrowOut: 0, stockWh: 0, leftoversStock: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // For new materials, ensure materialName is present because it is the PK
    if (!formData.materialName) {
      alert("Nama Material wajib diisi!");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("master_materials").upsert(formData);
    
    setIsSaving(false);
    if (error) {
      alert("Gagal menyimpan data: " + error.message);
    } else {
      setIsModalOpen(false);
      onRefresh && onRefresh();
    }
  };

  const handleDelete = async (materialName?: string | null) => {
    if (!materialName) return;
    if (!window.confirm("Yakin ingin menghapus Material ini? Pastikan tidak ada transaksi yang menggunakan material ini.")) return;
    
    const { error } = await supabase.from("master_materials").delete().eq("materialName", materialName);
    if (error) {
      alert("Gagal menghapus data: " + error.message);
    } else {
      onRefresh && onRefresh();
    }
  };

  return (
    <div className="page active" id="page-material">
      <div className="filters-bar" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="search-field" style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Cari kode atau nama material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: 34, width: "100%", height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <button className="btn" onClick={handleExportCsv} style={{ height: 36 }}>
          <Download size={16} style={{ marginRight: 6 }} /> Export CSV
        </button>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ height: 36 }}>
          <Plus size={16} style={{ marginRight: 6 }} /> Tambah Material
        </button>
      </div>

      <div className="chips" id="mat-chips" style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`chip ${categoryFilter === "" ? "active" : ""}`} onClick={() => setCategoryFilter("")}>
          Semua ({materials.length})
        </button>
        <button className={`chip ${categoryFilter === "ZTE Material" ? "active" : ""}`} onClick={() => setCategoryFilter("ZTE Material")}>
          ZTE Material ({materials.filter(m => m.typeMaterial === "ZTE Material").length})
        </button>
        <button className={`chip ${categoryFilter === "EMR Material" ? "active" : ""}`} onClick={() => setCategoryFilter("EMR Material")}>
          EMR Material ({materials.filter(m => m.typeMaterial === "EMR Material").length})
        </button>
        <button className={`chip ${categoryFilter === "Accessories" ? "active" : ""}`} onClick={() => setCategoryFilter("Accessories")}>
          Accessories ({materials.filter(m => m.typeMaterial === "Accessories").length})
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table id="mat-table">
            <thead>
              <tr>
                <SortableHeader label="Kode" sortKey="materialCode" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Nama Material" sortKey="materialName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Tipe Material" sortKey="typeMaterial" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Sumber" sortKey="sourceMaterial" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Unit" sortKey="unit" currentSort={sortConfig} requestSort={requestSort} />
                <th style={{ width: 80, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedMaterials.map((item) => (
                <tr key={item.materialCode}>
                  <td className="mono">{item.materialCode}</td>
                  <td>
                    <span 
                      style={{ cursor: "pointer", color: "var(--blue)", textDecoration: "underline" }} 
                      onClick={() => onMaterialClick && onMaterialClick(item.materialName || "")}
                    >
                      {item.materialName}
                    </span>
                  </td>
                  <td>{item.typeMaterial}</td>
                  <td>{item.sourceMaterial}</td>
                  <td>{item.unit}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--blue)", marginRight: 6 }} onClick={() => handleOpenModal(item)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--red)" }} onClick={() => handleDelete(item.materialName)} title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada material yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Master Material" : "Tambah Material"}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label>Kode Material</label>
              <input value={formData.materialCode || ""} onChange={e => setFormData({...formData, materialCode: e.target.value})} />
            </div>
            <div className="form-group span-2">
              <label>Nama Material (Primary Key)</label>
              <input required disabled={!!editingItem} value={formData.materialName || ""} onChange={e => setFormData({...formData, materialName: e.target.value})} />
              <div className="form-hint">Tidak bisa diubah setelah dibuat.</div>
            </div>
            <div className="form-group">
              <label>Tipe Material</label>
              <input value={formData.typeMaterial || ""} onChange={e => setFormData({...formData, typeMaterial: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Sumber Material</label>
              <input value={formData.sourceMaterial || ""} onChange={e => setFormData({...formData, sourceMaterial: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input value={formData.unit || ""} onChange={e => setFormData({...formData, unit: e.target.value})} />
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
