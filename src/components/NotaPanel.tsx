import { Printer, ReceiptText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { TransactionRecord } from "../types";
import { asDateInput, formatNumber, normalizeText } from "../lib/wims";

interface NotaPanelProps {
  logRows: TransactionRecord[];
}

export function NotaPanel({ logRows }: NotaPanelProps) {
  const notaOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of logRows) {
      const nota = normalizeText(row.notaNo);
      if (!nota || seen.has(nota)) continue;
      seen.add(nota);
      out.push(nota);
    }
    return out.reverse();
  }, [logRows]);
  const [selectedNota, setSelectedNota] = useState(notaOptions[0] ?? "");
  const items = useMemo(
    () => logRows.filter((row) => normalizeText(row.notaNo) === normalizeText(selectedNota)),
    [logRows, selectedNota],
  );
  const head = items[0];

  return (
    <section className="panel nota-panel">
      <div className="panel-heading">
        <div>
          <h2>Nota Print</h2>
          <p>Preview nota dari Logfile_S berdasarkan Nota No.</p>
        </div>
        <div className="toolbar">
          <label className="toolbar-field search-field">
            <Search size={15} />
            <input list="nota-options" value={selectedNota} onChange={(event) => setSelectedNota(event.target.value)} placeholder="Nota No." />
            <datalist id="nota-options">
              {notaOptions.slice(0, 300).map((nota) => (
                <option key={nota} value={nota} />
              ))}
            </datalist>
          </label>
          <button type="button" className="secondary-button" onClick={() => window.print()} disabled={!head}>
            <Printer size={17} />
            Print
          </button>
        </div>
      </div>

      {!head ? (
        <div className="empty-state">
          <ReceiptText size={32} />
          <p>Pilih Nota No. yang tersedia di Logfile.</p>
        </div>
      ) : (
        <div className="nota-sheet">
          <header>
            <div>
              <span>Warehouse Inventory Monitoring System</span>
              <h3>{head.notaNo}</h3>
            </div>
            <strong>{head.transactionType}</strong>
          </header>

          <div className="nota-meta">
            <div>
              <span>WH GCI</span>
              <strong>{head.whGci}</strong>
            </div>
            <div>
              <span>PIC Warehouse</span>
              <strong>{head.picWarehouse || "-"}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{asDateInput(head.date)}</strong>
            </div>
            <div>
              <span>Site Name</span>
              <strong>{head.siteName || "-"}</strong>
            </div>
            <div>
              <span>ID Card</span>
              <strong>{head.idCard || "-"}</strong>
            </div>
            <div>
              <span>Car Plate</span>
              <strong>{head.carPlate || "-"}</strong>
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Unit</th>
                  <th className="numeric">Qty</th>
                  <th>Condition</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.materialCode}</td>
                    <td>{item.materialName}</td>
                    <td>{item.unit}</td>
                    <td className="numeric">{formatNumber(item.qty)}</td>
                    <td>{item.condition || "-"}</td>
                    <td>{item.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer>
            <div>
              <span>PIC Delivery</span>
              <strong>{head.picDelivery || "-"}</strong>
            </div>
            <div>
              <span>Vendor Supplier</span>
              <strong>{head.vendorSupplier || "-"}</strong>
            </div>
          </footer>
        </div>
      )}
    </section>
  );
}
