import { QRCodeSVG } from "qrcode.react";

interface QrDisplayProps {
  value: string;
  title?: string;
  size?: number;
}

export function QrDisplay({ value, title, size = 120 }: QrDisplayProps) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {title && <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>{title}</div>}
      <div style={{ padding: 6, background: "white", borderRadius: 6, border: "1px solid var(--border)" }}>
        <QRCodeSVG value={value || "https://wims"} size={size} level="M" />
      </div>
      <div style={{ fontSize: 10, color: "var(--text3)", maxWidth: size, textAlign: "center", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}
