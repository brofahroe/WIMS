import { Download, Search, Plus, Edit2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { SiteItem } from "../types";
import { normalizeText } from "../lib/wims";
import { useSortableData } from "../hooks/useSortableData";
import { SortableHeader } from "./SortableHeader";
import { Modal } from "./ui/Modal";
import { supabase } from "../lib/supabase";

interface SiteTrackerProps {
  sites: SiteItem[];
  onRefresh?: () => void;
}

export function SiteTracker({ sites, onRefresh }: SiteTrackerProps) {
  const [query, setQuery] = useState("");
  const [msFilter, setMsFilter] = useState("Semua");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SiteItem | null>(null);
  const [formData, setFormData] = useState<Partial<SiteItem>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query).toLowerCase();
    return sites
      .filter((site) => {
        if (msFilter === "Approved" && !site.finalMilestone?.toLowerCase().includes("approved") && !site.finalMilestone?.toLowerCase().includes("progress")) return false;
        if (msFilter === "Rejected" && !site.finalMilestone?.toLowerCase().includes("reject")) return false;
        if (msFilter === "Done" && !site.finalMilestone?.toLowerCase().includes("done") && !site.finalMilestone?.toLowerCase().includes("pac")) return false;
        
        if (!normalizedQuery) return true;
        return [site.siteId, site.siteName, site.city, site.team, site.finalMilestone]
          .some((value) => normalizeText(value).toLowerCase().includes(normalizedQuery));
      });
  }, [query, sites, msFilter]);

  const { items: sortedSites, requestSort, sortConfig } = useSortableData(filtered);

  const handleExportCsv = () => {
    const headers = ["Site ID", "Site Name", "City", "WH Drop", "Team", "Milestone"];
    const rows = filtered.map(s => [
      `"${s.siteId || ""}"`,
      `"${s.siteName || ""}"`,
      `"${s.city || ""}"`,
      `"${s.region || ""}"`,
      `"${s.team || ""}"`,
      `"${s.finalMilestone || ""}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "WIMS_Site.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenModal = (site?: SiteItem) => {
    if (site) {
      setEditingItem(site);
      setFormData(site);
    } else {
      setEditingItem(null);
      setFormData({
        siteId: "", siteName: "", city: "", region: "", team: "", finalMilestone: "", address: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const { error } = await supabase.from("sites").upsert(formData);
    
    setIsSaving(false);
    if (error) {
      alert("Gagal menyimpan data: " + error.message);
    } else {
      setIsModalOpen(false);
      onRefresh && onRefresh();
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Yakin ingin menghapus Site ini?")) return;
    
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) {
      alert("Gagal menghapus data: " + error.message);
    } else {
      onRefresh && onRefresh();
    }
  };

  const getMsBadge = (ms: string) => {
    if (!ms) return <span className="badge">No Status</span>;
    const lower = ms.toLowerCase();
    if (lower.includes("reject")) return <span className="badge" style={{ background: "var(--red-light)", color: "var(--red)" }}>{ms}</span>;
    if (lower.includes("done") || lower.includes("pac")) return <span className="badge" style={{ background: "var(--green-light)", color: "var(--green)" }}>{ms}</span>;
    if (lower.includes("progress") || lower.includes("approved")) return <span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{ms}</span>;
    return <span className="badge" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>{ms}</span>;
  };

  return (
    <div className="page active" id="page-site">
      <div className="filters-bar" style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <div className="search-field" style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text3)" }} />
          <input
            type="text"
            placeholder="Cari Site ID, Nama, atau Team..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ paddingLeft: 34, width: "100%", height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
        </div>
        <select 
          value={msFilter} 
          onChange={(e) => setMsFilter(e.target.value)}
          style={{ height: 36, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)" }}
        >
          <option value="Semua">Semua Milestone</option>
          <option value="Approved">Approved / Progress</option>
          <option value="Done">Done / PAC</option>
          <option value="Rejected">Rejected</option>
        </select>
        <button className="btn" onClick={handleExportCsv} style={{ height: 36 }}>
          <Download size={16} style={{ marginRight: 6 }} /> Export CSV
        </button>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ height: 36 }}>
          <Plus size={16} style={{ marginRight: 6 }} /> Tambah Site
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table id="site-table">
            <thead>
              <tr>
                <SortableHeader label="Site ID" sortKey="siteId" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Site Name" sortKey="siteName" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="City" sortKey="city" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Region" sortKey="region" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Team" sortKey="team" currentSort={sortConfig} requestSort={requestSort} />
                <SortableHeader label="Milestone" sortKey="finalMilestone" currentSort={sortConfig} requestSort={requestSort} />
                <th style={{ width: 80, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sortedSites.map((site) => (
                <tr key={`${site.siteId}-${site.siteName}`}>
                  <td className="mono">{site.siteId}</td>
                  <td>{site.siteName}</td>
                  <td>{site.city || "-"}</td>
                  <td>{site.region || "-"}</td>
                  <td>{site.team || "-"}</td>
                  <td>{getMsBadge(site.finalMilestone || "")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--blue)", marginRight: 6 }} onClick={() => handleOpenModal(site)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="icon-button" style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--red)" }} onClick={() => handleDelete(site.id as number)} title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ textAlign: "center", padding: 24, color: "var(--text3)" }}>
                    Tidak ada site yang sesuai
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div id="site-count" style={{ fontSize: 12, color: "var(--text3)", marginTop: 12, textAlign: "right" }}>
        Menampilkan {filtered.length} dari {sites.length} site
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Site" : "Tambah Site"}>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-group">
              <label>Site ID</label>
              <input required value={formData.siteId || ""} onChange={e => setFormData({...formData, siteId: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Site Name</label>
              <input required value={formData.siteName || ""} onChange={e => setFormData({...formData, siteName: e.target.value})} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input value={formData.city || ""} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Region</label>
              <input value={formData.region || ""} onChange={e => setFormData({...formData, region: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Team</label>
              <input value={formData.team || ""} onChange={e => setFormData({...formData, team: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Milestone</label>
              <select value={formData.finalMilestone || ""} onChange={e => setFormData({...formData, finalMilestone: e.target.value})}>
                <option value="">- Pilih Status -</option>
                <option value="Done">Done</option>
                <option value="Progress">Progress</option>
                <option value="Rejected">Rejected</option>
                <option value="Approved">Approved</option>
                <option value="PAC">PAC</option>
              </select>
            </div>
            <div className="form-group span-2">
              <label>Address</label>
              <textarea rows={2} value={formData.address || ""} onChange={e => setFormData({...formData, address: e.target.value})} />
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
