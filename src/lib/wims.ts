import type {
  ActionEvent,
  DeliveryOrder,
  InventoryRow,
  MaterialItem,
  MasterData,
  SiteItem,
  TaggingType,
  TransactionFormState,
  TransactionRecord,
  WarehouseOption,
} from "../types";

export const POSITIVE_TYPES = new Set(["INBOUND", "BORROW IN", "TRANSFER IN"]);
export const NEGATIVE_TYPES = new Set(["OUTBOUND", "BORROW OUT", "TRANSFER OUT"]);

export const PREFIX_BY_TYPE: Record<string, string> = {
  "BORROW IN": "BOI",
  "BORROW OUT": "BOO",
  "TRANSFER IN": "TFI",
  "TRANSFER OUT": "TFO",
  INBOUND: "INB",
  OUTBOUND: "OUB",
};

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeType(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

export function compareText(a: unknown, b: unknown): boolean {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

export function asDateInput(value?: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const normalized = normalizeText(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

export function currentTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value || 0);
}

export function formatRowId(index: number): string {
  return String(index).padStart(3, "0");
}

export function getWarehouse(master: MasterData, whGci: string): WarehouseOption | undefined {
  return master.warehouses.find((item) => compareText(item.whGci, whGci));
}

export function getMaterial(materials: MaterialItem[], materialName: string): MaterialItem | undefined {
  return materials.find((item) => compareText(item.materialName, materialName));
}

export function getSiteOrder(deliveryOrders: DeliveryOrder[], siteName: string, materialName?: string): DeliveryOrder | undefined {
  return (
    deliveryOrders.find(
      (item) =>
        compareText(item.siteName, siteName) &&
        (!materialName || compareText(item.materialName, materialName)),
    ) ?? deliveryOrders.find((item) => compareText(item.siteName, siteName))
  );
}

export function transactionBucket(type: string | null): keyof Pick<
  InventoryRow,
  | "inboundCalc"
  | "outboundCalc"
  | "transferInCalc"
  | "transferOutCalc"
  | "borrowInCalc"
  | "borrowOutCalc"
  | "returnInCalc"
  | "returnOutCalc"
> | null {
  const normalized = normalizeType(type);
  if (normalized === "INBOUND") return "inboundCalc";
  if (normalized === "OUTBOUND") return "outboundCalc";
  if (normalized === "TRANSFER IN") return "transferInCalc";
  if (normalized === "TRANSFER OUT") return "transferOutCalc";
  if (normalized === "BORROW IN") return "borrowInCalc";
  if (normalized === "BORROW OUT") return "borrowOutCalc";
  return null;
}

export function movementSign(type: string | null): number {
  const normalized = normalizeType(type);
  if (POSITIVE_TYPES.has(normalized)) return 1;
  if (NEGATIVE_TYPES.has(normalized)) return -1;
  return 0;
}

export interface ReelBalance {
  drumNumber: string;
  taggingType: TaggingType;
  remaining: number;
  date: string;
}

export function getAvailableReels(
  materialName: string,
  whGci: string,
  taggingType: TaggingType,
  rows: TransactionRecord[]
): ReelBalance[] {
  const balances: Record<string, ReelBalance> = {};

  for (const row of rows) {
    if (!compareText(row.materialName, materialName) || !compareText(row.whGci, whGci) || row.taggingType !== taggingType) continue;
    const reelId = row.drumNumber || row.tagId;
    if (!reelId) continue;

    const sign = movementSign(row.transactionType);
    if (sign === 0) continue;
    const qty = Number(row.qty) || 0;

    if (!balances[reelId]) {
      balances[reelId] = {
        drumNumber: reelId,
        taggingType: row.taggingType,
        remaining: 0,
        date: row.date || "",
      };
    }
    balances[reelId].remaining += sign * qty;
    
    if (sign > 0 && (!balances[reelId].date || (row.date && row.date < balances[reelId].date))) {
      balances[reelId].date = row.date || "";
    }
  }

  return Object.values(balances)
    .filter(b => b.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date)); // FIFO
}

export function calculateInventory(
  materials: MaterialItem[],
  logRows: TransactionRecord[],
  leftoverRows: TransactionRecord[],
  whFilter: string,
): InventoryRow[] {
  const includeWh = (row: TransactionRecord) => whFilter === "ALL" || compareText(row.whGci, whFilter);

  return materials.map((material) => {
    const row: InventoryRow = {
      ...material,
      inboundCalc: 0,
      outboundCalc: 0,
      transferInCalc: 0,
      transferOutCalc: 0,
      borrowInCalc: 0,
      borrowOutCalc: 0,
      returnInCalc: 0,
      returnOutCalc: 0,
      stockWhCalc: 0,
      leftoversStockCalc: 0,
    };
    for (const tx of logRows) {
      if (!includeWh(tx) || !compareText(tx.materialName, material.materialName)) continue;
      const bucket = transactionBucket(tx.transactionType);
      if (bucket) row[bucket] += Number(tx.qty) || 0;
    }
    row.stockWhCalc =
      row.inboundCalc +
      row.transferInCalc +
      row.borrowInCalc -
      row.outboundCalc -
      row.transferOutCalc -
      row.borrowOutCalc;

    for (const tx of leftoverRows) {
      if (!includeWh(tx) || !compareText(tx.materialName, material.materialName)) continue;
      row.leftoversStockCalc += movementSign(tx.transactionType) * (Number(tx.qty) || 0);
    }
    return row;
  });
}

export function generateNotaNo(type: string, whGci: string, warehouses: WarehouseOption[], rows: TransactionRecord[], date: string): string {
  const prefix = PREFIX_BY_TYPE[normalizeType(type)] ?? "TRX";
  const warehouse = warehouses.find((item) => compareText(item.whGci, whGci));
  const whId = normalizeText(warehouse?.whId) || "W001";
  const dateObj = date ? new Date(`${date}T00:00:00`) : new Date();
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const stem = `${prefix}-${whId}${yy}${mm}-`;
  const next = rows.reduce((max, row) => {
    const nota = normalizeText(row.notaNo);
    if (!nota.startsWith(stem)) return max;
    const tail = Number(nota.slice(stem.length));
    return Number.isFinite(tail) ? Math.max(max, tail) : max;
  }, 0);
  return `${stem}${String(next + 1).padStart(3, "0")}`;
}

export function makeTempRecord(
  form: TransactionFormState,
  lineId: number,
  master: MasterData,
  materials: MaterialItem[],
  deliveryOrders: DeliveryOrder[],
  existingRows: TransactionRecord[],
): TransactionRecord {
  const material = getMaterial(materials, form.materialName);
  const order = getSiteOrder(deliveryOrders, form.siteName, form.materialName);
  const warehouse = getWarehouse(master, form.whGci);
  const notaNo =
    normalizeText(form.notaNo) ||
    generateNotaNo(form.transactionType, form.whGci, master.warehouses, existingRows, form.date);

  return {
    id: `temp-${Date.now()}-${lineId}`,
    source: "temp",
    rowId: null,
    lineId,
    taggingType: form.taggingType,
    transactionType: normalizeType(form.transactionType),
    notaNo,
    whGci: form.whGci,
    picWarehouse: warehouse?.picWh ?? null,
    date: form.date,
    time: form.time,
    sourceDestination: form.sourceDestination,
    typeMaterial: material?.typeMaterial ?? null,
    materialName: form.materialName,
    materialCode: material?.materialCode ?? null,
    unit: material?.unit ?? null,
    qty: Number(form.qty) || 0,
    siteId: order?.siteId ?? null,
    siteName: form.siteName || order?.siteName || null,
    doNumber: form.doNumber || order?.doNumber || null,
    dnNumber: form.dnNumber || order?.dnNumber || null,
    condition: form.condition,
    picDelivery: form.picDelivery,
    vendorSupplier: form.vendorSupplier,
    idCard: form.idCard,
    carPlate: form.carPlate,
    remarks: form.remarks,
    drumNumber: form.drumNumber || null,
    proofLink: form.proofLink || null,
  };
}

export function validateForm(
  form: TransactionFormState,
  materials: MaterialItem[],
  inventory: InventoryRow[],
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const material = getMaterial(materials, form.materialName);
  const qty = Number(form.qty);

  if (!form.taggingType) errors.push("Tagging Type wajib diisi.");
  if (!form.transactionType) errors.push("Transaction Type wajib diisi.");
  if (!form.whGci) errors.push("WH GCI wajib diisi.");
  if (!material) errors.push("Material Name harus dipilih dari master material.");
  if (!Number.isFinite(qty) || qty <= 0) errors.push("Qty harus lebih besar dari 0.");

  const normalizedType = normalizeType(form.transactionType);
  if (material?.unit?.toUpperCase() === "METER" && POSITIVE_TYPES.has(normalizedType) && form.taggingType !== "LEFTOVERS") {
    warnings.push("Material kabel sisa/damage dengan unit Meter sebaiknya memakai Tagging Type Leftovers.");
  }

  if (NEGATIVE_TYPES.has(normalizedType) && material) {
    const stock = inventory.find((row) => compareText(row.materialName, material.materialName))?.stockWhCalc ?? 0;
    if (qty > stock) warnings.push(`Qty lebih besar dari stock WH saat ini (${formatNumber(stock)} ${material.unit ?? ""}).`);
  }

  return { errors, warnings };
}

export function processTempRows(
  tempRows: TransactionRecord[],
  logRows: TransactionRecord[],
  leftoverRows: TransactionRecord[],
  master: MasterData,
): {
  nextLogRows: TransactionRecord[];
  nextLeftoverRows: TransactionRecord[];
  events: ActionEvent[];
  newRows: TransactionRecord[];
} {
  let logIndex = logRows.length;
  let leftoverIndex = leftoverRows.length;
  const now = new Date().toISOString();
  const events: ActionEvent[] = [];

  const nextLogRows = [...logRows];
  const nextLeftoverRows = [...leftoverRows];
  const newRows: TransactionRecord[] = [];

  for (const row of tempRows) {
    if (row.taggingType === "LEFTOVERS") {
      leftoverIndex += 1;
      const prefix =
        master.labelPrefixes.find((item) => compareText(item.material, row.materialName))?.prefix ??
        "LO";
      const newRow = {
        ...row,
        id: `leftovers-new-${Date.now()}-${leftoverIndex}`,
        source: "leftovers" as const,
        rowId: formatRowId(leftoverIndex),
        tagId: row.tagId ?? `${prefix}-${formatRowId(leftoverIndex)}-${formatNumber(row.qty)}${row.unit === "Meter" ? "m" : ""}`,
        inOutQty: movementSign(row.transactionType),
        loCriteria: row.unit === "Meter" ? classifyLeftover(row.qty) : null,
      };
      nextLeftoverRows.push(newRow);
      newRows.push(newRow);
    } else {
      logIndex += 1;
      const newRow = {
        ...row,
        id: `logfile-new-${Date.now()}-${logIndex}`,
        source: "logfile" as const,
        rowId: formatRowId(logIndex),
      };
      nextLogRows.push(newRow);
      newRows.push(newRow);
    }

    events.push({
      id: `event-${Date.now()}-${events.length}`,
      at: now,
      user: "Admin WH",
      action: "PROCESS",
      details: `${row.transactionType} - ${row.notaNo} / ${row.materialName} / ${formatNumber(row.qty)} ${row.unit ?? ""}`,
      status: "SUCCESS",
    });
  }

  return { nextLogRows, nextLeftoverRows, events, newRows };
}

export function classifyLeftover(qty: number): string {
  if (qty >= 2000) return ">2000";
  if (qty >= 1500) return ">1500";
  if (qty >= 1000) return ">1000";
  if (qty >= 500) return ">500";
  if (qty >= 250) return ">250";
  if (qty >= 100) return ">100";
  return "<100";
}

export function buildRecentEvents(rows: TransactionRecord[]): ActionEvent[] {
  return rows
    .slice(-8)
    .reverse()
    .map((row, index) => ({
      id: `seed-event-${row.id}-${index}`,
      at: `${asDateInput(row.date)}T${normalizeText(row.time) || "00:00"}:00`,
      user: row.picWarehouse || "Admin WH",
      action: row.source === "leftovers" ? "LEFTOVER" : "LOGFILE",
      details: `${row.transactionType} - ${row.notaNo} / ${row.materialName} / ${formatNumber(row.qty)} ${row.unit ?? ""}`,
      status: "SUCCESS",
    }));
}

export function deriveSiteOptions(deliveryOrders: DeliveryOrder[], sites: SiteItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const site of [...sites.map((item) => item.siteName), ...deliveryOrders.map((item) => item.siteName)]) {
    const normalized = normalizeText(site);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function useSeedOrStorage<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  const raw = window.localStorage.getItem(key);
  if (!raw) return seed;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return seed;
  }
}

export function saveStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience layer; the UI should continue even when it is full or disabled.
  }
}
