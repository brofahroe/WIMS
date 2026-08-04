import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose?: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const scannerId = "wims-qr-reader";

    const startScanner = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";
      const div = document.createElement("div");
      div.id = scannerId;
      containerRef.current.appendChild(div);

      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!mounted) return;
            setIsScanning(false);
            onScan(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {}
        );
        if (mounted) setIsScanning(true);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.");
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current && isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan, isScanning, onClose]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div ref={containerRef} style={{ width: "100%", minHeight: 250, borderRadius: 8, overflow: "hidden" }} />
      {error && <div className="alert alert-danger" style={{ width: "100%" }}>{error}</div>}
      {!isScanning && !error && <div style={{ color: "var(--text3)" }}>Menginisialisasi kamera...</div>}
      {onClose && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} style={{ marginTop: 12 }}>
          Tutup
        </button>
      )}
    </div>
  );
}
