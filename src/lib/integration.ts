import type { TransactionRecord } from "../types";

export interface IntegrationExport {
  format: "json" | "csv" | "xml";
  data: unknown;
  filename: string;
}

export function buildTransactionExport(rows: TransactionRecord[], format: IntegrationExport["format"] = "json"): IntegrationExport {
  if (format === "csv") {
    const headers = [
      "id", "source", "rowId", "tagId", "transactionType", "notaNo", "whGci", "picWarehouse", "date", "time",
      "sourceDestination", "typeMaterial", "materialName", "materialCode", "unit", "qty", "siteId", "siteName",
      "doNumber", "dnNumber", "condition", "picDelivery", "vendorSupplier", "idCard", "carPlate", "remarks",
      "drumNumber", "proofLink", "approvalStatus", "approvedBy", "approvedAt", "created_at"
    ];
    const csvRows = rows.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`).join(","));
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
    return {
      format: "csv",
      data: csvContent,
      filename: `wims-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  if (format === "xml") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<transactions>
  ${rows.map((r) => `  <transaction>
    <id>${r.id}</id>
    <type>${r.transactionType}</type>
    <notaNo>${r.notaNo}</notaNo>
    <warehouse>${r.whGci}</warehouse>
    <date>${r.date}</date>
    <material>${r.materialName}</material>
    <qty>${r.qty}</qty>
    <unit>${r.unit}</unit>
    <site>${r.siteName}</site>
    <status>${r.approvalStatus ?? "APPROVED"}</status>
  </transaction>`).join("\n")}
</transactions>`;
    return {
      format: "xml",
      data: xml,
      filename: `wims-transactions-${new Date().toISOString().slice(0, 10)}.xml`,
    };
  }

  return {
    format: "json",
    data: rows,
    filename: `wims-transactions-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

export async function sendToWebhook(url: string, payload: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}
