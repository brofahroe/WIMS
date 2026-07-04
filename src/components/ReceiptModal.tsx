import { Printer, X } from "lucide-react";
import type { TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";

interface ReceiptModalProps {
  notaNo: string;
  rows: TransactionRecord[];
  onClose: () => void;
}

export function ReceiptModal({ notaNo, rows, onClose }: ReceiptModalProps) {
  if (!rows || rows.length === 0) return null;

  const firstRow = rows[0];
  const date = firstRow.date ? new Date(firstRow.date + "T00:00:00").toLocaleDateString("id-ID", {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : "-";
  
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal receipt-modal">
        <div className="modal-header hide-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={18} />
            <h3 style={{ margin: 0, fontSize: 16 }}>Receipt Transaksi</h3>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        
        <div className="modal-body" style={{ padding: 0 }}>
          {/* Printable Area */}
          <div className="receipt-paper" id="printable-receipt">
            <div className="receipt-header">
              <h3>PT. GCI INDONESIA</h3>
              <p>FTTH Project - Sistem Inventory</p>
              <h4 style={{ margin: '12px 0 4px', color: 'var(--blue)' }}>{notaNo}</h4>
              <p style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{firstRow.transactionType}</p>
            </div>
            
            <div className="receipt-divider"></div>
            
            <div className="receipt-meta">
              <div className="meta-row">
                <span>Tanggal</span>
                <span>{date}</span>
              </div>
              <div className="meta-row">
                <span>Gudang</span>
                <span>{firstRow.whGci}</span>
              </div>
              {firstRow.siteName && (
                <div className="meta-row">
                  <span>Site / Tujuan</span>
                  <span>{firstRow.siteName}</span>
                </div>
              )}
              {firstRow.picWarehouse && (
                <div className="meta-row">
                  <span>Dibuat Oleh</span>
                  <span>{firstRow.picWarehouse}</span>
                </div>
              )}
            </div>

            <div className="receipt-divider"></div>

            <table className="receipt-items">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Material</th>
                  <th style={{ textAlign: 'right' }}>Qty/Sat.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td style={{ textAlign: 'left', paddingBottom: 8 }}>
                      <div>{row.materialName}</div>
                      {row.drumNumber && <div style={{ fontSize: '0.85em', color: '#666' }}>SN: {row.drumNumber}</div>}
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                      {formatNumber(row.qty)} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="receipt-divider"></div>

            <div className="receipt-signatures">
              <div className="sig-box">
                <div className="sig-line"></div>
                <div>Petugas Gudang</div>
              </div>
              <div className="sig-box">
                <div className="sig-line"></div>
                <div>Penerima / Waspang</div>
              </div>
            </div>

            <div className="receipt-footer">
              Dicetak: {new Date().toLocaleString("id-ID")}<br/>
              GCI Inventory System - PT. GCI Indonesia
            </div>
          </div>
        </div>

        <div className="modal-footer hide-print">
          <button className="btn" onClick={onClose} style={{ background: 'transparent', color: 'var(--text1)' }}>Tutup</button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Cetak
          </button>
        </div>
      </div>
    </div>
  );
}
