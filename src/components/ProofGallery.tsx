import { X, Download } from "lucide-react";
import { useState } from "react";

interface ProofGalleryProps {
  images: string[];
  onClose: () => void;
}

export function ProofGallery({ images, onClose }: ProofGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  const current = images[currentIndex];

  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `proof-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, width: "90%" }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: 16 }}>Bukti Foto ({currentIndex + 1} / {images.length})</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={() => handleDownload(current, currentIndex)}>
              <Download size={14} /> Download
            </button>
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="modal-body" style={{ padding: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ position: "relative", width: "100%", maxHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={current}
              alt={`Bukti ${currentIndex + 1}`}
              style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
            />
          </div>
          {images.length > 1 && (
            <div style={{ display: "flex", gap: 8, padding: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    padding: 0,
                    border: idx === currentIndex ? "2px solid var(--primary)" : "2px solid transparent",
                    borderRadius: 6,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} style={{ width: 50, height: 50, objectFit: "cover", borderRadius: 4 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
