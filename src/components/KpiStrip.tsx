import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, PackageCheck } from "lucide-react";
import type { InventoryRow, TransactionRecord } from "../types";
import { formatNumber } from "../lib/wims";

interface KpiStripProps {
  inventory: InventoryRow[];
  tempRows: TransactionRecord[];
  logRows: TransactionRecord[];
  leftoverRows: TransactionRecord[];
}

export function KpiStrip({ inventory, tempRows, logRows, leftoverRows }: KpiStripProps) {
  const totalStock = inventory.reduce((sum, row) => sum + row.stockWhCalc, 0);
  const inbound = inventory.reduce((sum, row) => sum + row.inboundCalc + row.transferInCalc + row.borrowInCalc + row.returnInCalc, 0);
  const outbound = inventory.reduce((sum, row) => sum + row.outboundCalc + row.transferOutCalc + row.borrowOutCalc + row.returnOutCalc, 0);
  const leftovers = inventory.reduce((sum, row) => sum + row.leftoversStockCalc, 0);

  const kpis = [
    { label: "Total Stock (Qty)", value: totalStock, unit: "Qty", icon: Boxes, tone: "teal" },
    { label: "Inbound (Qty)", value: inbound, unit: "Qty", icon: ArrowDownToLine, tone: "green" },
    { label: "Outbound (Qty)", value: outbound, unit: "Qty", icon: ArrowUpFromLine, tone: "blue" },
    { label: "Leftovers (Qty)", value: leftovers, unit: "Qty", icon: PackageCheck, tone: "amber" },
    { label: "Open Rows", value: tempRows.length, unit: "Rows", icon: ClipboardCheck, tone: "slate" },
  ];

  return (
    <section className="kpi-strip" aria-label="WIMS summary">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div className="kpi" key={kpi.label}>
            <div className={`kpi-icon tone-${kpi.tone}`}>
              <Icon size={26} />
            </div>
            <div>
              <span>{kpi.label}</span>
              <strong>{formatNumber(kpi.value)}</strong>
              <small>{kpi.unit}</small>
            </div>
          </div>
        );
      })}
      <div className="kpi-meta">
        <span>{formatNumber(logRows.length)} logfile rows</span>
        <span>{formatNumber(leftoverRows.length)} leftover rows</span>
      </div>
    </section>
  );
}
