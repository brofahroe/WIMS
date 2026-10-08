import type {
  ActionEvent,
  DeliveryOrder,
  InventoryRow,
  MaterialItem,
  MasterData,
  OpeningBalanceRecord,
  SiteItem,
  TaggingType,
  TransactionFormState,
  TransactionRecord,
  User,
  WarehouseOption,
  WarehouseTransferLine,
  SiteMonthlyAggregate,
  SiteMonthlyMaterialBreakdown,
} from "../types";

export const POSITIVE_TYPES = new Set(["INBOUND", "BORROW IN", "TRANSFER IN"]);
export const NEGATIVE_TYPES = new Set(["OUTBOUND", "BORROW OUT", "TRANSFER OUT"]);
export const APPROVAL_THRESHOLD_QTY = 5000;

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

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function safeReplace(value: unknown, pattern: string | RegExp, replacement: string): string {
  return safeString(value).replace(pattern, replacement);
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

export function canAccessWarehouse(user: User, whGci: string): boolean {
  if (user.role === "Admin" || user.role === "Manager") return true;
  return user.warehouseAssignments?.some((warehouse) => compareText(warehouse, whGci)) ?? false;
}

export function getAccessibleWarehouses(warehouses: WarehouseOption[], user: User): WarehouseOption[] {
  return warehouses.filter((warehouse) => {
    const whGci = normalizeText(warehouse.whGci);
    return whGci && whGci !== "ALL" && whGci !== "Dummy" && canAccessWarehouse(user, whGci);
  });
}

export function canTransactInWarehouse(warehouse: WarehouseOption | undefined): boolean {
  return warehouse?.operationalStatus === "OPERATIONAL";
}

export function getInTransitQty(lines: WarehouseTransferLine[], materialName: string, whFilter: string): number {
  return lines.reduce((total, line) => {
    if (!compareText(line.materialName, materialName)) return total;
    if (whFilter !== "ALL" && !compareText(line.sourceWarehouseGci, whFilter) && !compareText(line.destinationWarehouseGci, whFilter)) return total;
    const outstanding = Number(line.qtySent) - Number(line.qtyReceived) - Number(line.qtyReturned) - Number(line.qtyWrittenOff);
    return total + Math.max(0, outstanding || 0);
  }, 0);
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
  rows: TransactionRecord[],
  openingBalances: OpeningBalanceRecord[] = [],
): ReelBalance[] {
  const balances: Record<string, ReelBalance> = {};
  const verifiedOpenings = openingBalances.filter((opening) =>
    opening.status === "VERIFIED" &&
    compareText(opening.materialName, materialName) &&
    compareText(opening.warehouseGci, whGci) &&
    opening.taggingType === taggingType,
  );
  const latestCutoff = verifiedOpenings.reduce((latest, opening) =>
    !latest || opening.effectiveDate > latest ? opening.effectiveDate : latest,
  "");

  for (const opening of verifiedOpenings) {
    if (opening.effectiveDate !== latestCutoff) continue;
    const reelId = normalizeText(opening.drumNumber);
    if (!reelId) continue;
    if (!balances[reelId]) {
      balances[reelId] = {
        drumNumber: reelId,
        taggingType: opening.taggingType,
        remaining: 0,
        date: opening.effectiveDate,
      };
    }
    balances[reelId].remaining += Number(opening.qty) || 0;
  }

  for (const row of rows) {
    if (!compareText(row.materialName, materialName) || !compareText(row.whGci, whGci) || row.taggingType !== taggingType) continue;
    if (latestCutoff && (!row.date || normalizeText(row.date).slice(0, 10) <= latestCutoff)) continue;
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
        // Bug #10 fix: initialize date only on first inbound so FIFO tracks
        // the *earliest* inbound date correctly.
        date: sign > 0 ? (row.date || "") : "",
      };
    } else if (sign > 0 && row.date) {
      // Bug #10 fix: keep the EARLIEST inbound date (was keeping latest due to
      // reversed comparison — old code updated when row.date < existing date,
      // which overwrites with a smaller/earlier value only on subsequent hits,
      // but skipped the very first assignment to a non-empty string entirely
      // when the initial value was already set).  Now we always track minimum.
      if (!balances[reelId].date || row.date < balances[reelId].date) {
        balances[reelId].date = row.date;
      }
    }

    balances[reelId].remaining += sign * qty;
  }

  return Object.values(balances)
    .filter(b => b.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date)); // FIFO: earliest inbound first
}

export function calculateInventory(
  materials: MaterialItem[],
  logRows: TransactionRecord[],
  leftoverRows: TransactionRecord[],
  whFilter: string,
  openingBalances: OpeningBalanceRecord[] = [],
  transferLines: WarehouseTransferLine[] = [],
): InventoryRow[] {
  const includeWh = (row: TransactionRecord) => whFilter === "ALL" || compareText(row.whGci, whFilter);
  const verifiedOpenings = openingBalances.filter((opening) => opening.status === "VERIFIED");

  return materials.map((material) => {
    const materialOpenings = verifiedOpenings.filter((opening) => compareText(opening.materialName, material.materialName));
    const latestCutoffByWarehouseAndTagging = new Map<string, string>();
    for (const opening of materialOpenings) {
      const key = `${normalizeText(opening.warehouseGci)}:${opening.taggingType}`;
      const latestCutoff = latestCutoffByWarehouseAndTagging.get(key);
      if (!latestCutoff || opening.effectiveDate > latestCutoff) latestCutoffByWarehouseAndTagging.set(key, opening.effectiveDate);
    }
    const includedOpenings = materialOpenings.filter((opening) =>
      (whFilter === "ALL" || compareText(opening.warehouseGci, whFilter)) &&
      latestCutoffByWarehouseAndTagging.get(`${normalizeText(opening.warehouseGci)}:${opening.taggingType}`) === opening.effectiveDate,
    );
    const includeMovement = (row: TransactionRecord) => {
      if (!includeWh(row)) return false;
      const cutoff = latestCutoffByWarehouseAndTagging.get(`${normalizeText(row.whGci)}:${row.taggingType}`);
      if (!cutoff) return true;
      return Boolean(row.date && normalizeText(row.date).slice(0, 10) > cutoff);
    };
    const row: InventoryRow = {
      ...material,
      openingStockCalc: includedOpenings
        .filter((opening) => opening.taggingType === "LOGFILE")
        .reduce((total, opening) => total + (Number(opening.qty) || 0), 0),
      openingLeftoversCalc: includedOpenings
        .filter((opening) => opening.taggingType === "LEFTOVERS")
        .reduce((total, opening) => total + (Number(opening.qty) || 0), 0),
      inTransitCalc: getInTransitQty(transferLines, material.materialName || "", whFilter),
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
      if (!includeMovement(tx) || !compareText(tx.materialName, material.materialName)) continue;
      const bucket = transactionBucket(tx.transactionType);
      if (bucket) row[bucket] += Number(tx.qty) || 0;
    }
    row.stockWhCalc =
      row.openingStockCalc +
      row.inboundCalc +
      row.transferInCalc +
      row.borrowInCalc -
      row.outboundCalc -
      row.transferOutCalc -
      row.borrowOutCalc;

    for (const tx of leftoverRows) {
      if (!includeMovement(tx) || !compareText(tx.materialName, material.materialName)) continue;
      row.leftoversStockCalc += movementSign(tx.transactionType) * (Number(tx.qty) || 0);
    }
    row.leftoversStockCalc += row.openingLeftoversCalc;
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

  // Bug #3 fix: only consider rows whose nota number belongs to the same
  // prefix+warehouse+year+month stem. Previously, rows from a different month
  // with a coincidentally matching prefix could inflate the sequence counter.
  const next = rows.reduce((max, row) => {
    const nota = normalizeText(row.notaNo);
    if (!nota.startsWith(stem)) return max;
    // The tail must be purely numeric (no extra characters)
    const tail = nota.slice(stem.length);
    if (!/^\d+$/.test(tail)) return max;
    const num = Number(tail);
    return Number.isFinite(num) ? Math.max(max, num) : max;
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
    const needsApproval = Number(row.qty) > APPROVAL_THRESHOLD_QTY;
    if (row.taggingType === "LEFTOVERS") {
      leftoverIndex += 1;
      const prefix =
        master.labelPrefixes.find((item) => compareText(item.material, row.materialName))?.prefix ??
        "LO";
      const newRow = {
        ...row,
        // Bug #2 fix: use crypto.randomUUID() instead of Date.now() so IDs are
        // guaranteed unique even when multiple rows are processed synchronously.
        id: crypto.randomUUID(),
        source: "leftovers" as const,
        rowId: formatRowId(leftoverIndex),
        tagId: row.tagId ?? `${prefix}-${formatRowId(leftoverIndex)}-${formatNumber(row.qty)}${row.unit === "Meter" ? "m" : ""}`,
        inOutQty: movementSign(row.transactionType),
        loCriteria: row.unit === "Meter" ? classifyLeftover(row.qty) : null,
        approvalStatus: (needsApproval ? "PENDING" : "APPROVED") as "PENDING" | "APPROVED",
      };
      nextLeftoverRows.push(newRow);
      newRows.push(newRow);
    } else {
      logIndex += 1;
      const newRow = {
        ...row,
        // Bug #2 fix: use crypto.randomUUID() instead of Date.now()
        id: crypto.randomUUID(),
        source: "logfile" as const,
        rowId: formatRowId(logIndex),
        approvalStatus: (needsApproval ? "PENDING" : "APPROVED") as "PENDING" | "APPROVED",
      };
      nextLogRows.push(newRow);
      newRows.push(newRow);
    }

    events.push({
      id: crypto.randomUUID(),
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

export function createAuditTrail(options: {
  action: string;
  tableName: string;
  recordId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  performedBy?: string | null;
}): import("../types").AuditTrail {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: options.action,
    tableName: options.tableName,
    recordId: options.recordId ?? null,
    oldValues: options.oldValues ?? null,
    newValues: options.newValues ?? null,
    performedBy: options.performedBy ?? null,
    performedAt: new Date().toISOString(),
  };
}

export function getMonthKey(dateStr?: string | null): string {
  if (!dateStr) return "";
  const normalized = normalizeText(dateStr);
  if (!normalized) return "";
  if (/^\d{4}-\d{2}/.test(normalized)) return normalized.slice(0, 7);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const INDO_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const INDO_MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Ags", "Sep", "Okt", "Nov", "Des"
];

export function formatMonthIndonesian(monthKey: string): string {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "-";
  const [yearStr, monthStr] = monthKey.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = INDO_MONTH_NAMES[monthIdx] || monthStr;
  return `${monthName} ${yearStr}`;
}

export function formatMonthShort(monthKey: string): string {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || "-";
  const [yearStr, monthStr] = monthKey.split("-");
  const monthIdx = parseInt(monthStr, 10) - 1;
  const monthName = INDO_MONTH_SHORT[monthIdx] || monthStr;
  return `${monthName} '${yearStr.slice(2)}`;
}

export interface SiteMonthlyOptions {
  includeTransfers?: boolean;
  warehouseFilter?: string;
  yearFilter?: string;
  monthFilter?: string;
  searchQuery?: string;
  activityFilter?: "ALL" | "BOTH" | "INBOUND_ONLY" | "OUTBOUND_ONLY";
}

export function aggregateSiteMonthly(
  records: TransactionRecord[],
  options: SiteMonthlyOptions = {}
): {
  items: SiteMonthlyAggregate[];
  allMonths: string[];
  allYears: number[];
  allWarehouses: string[];
  totals: {
    uniqueSites: number;
    inboundQty: number;
    outboundQty: number;
    netQty: number;
    totalTxCount: number;
  };
} {
  const allMonthsSet = new Set<string>();
  const allYearsSet = new Set<number>();
  const allWarehousesSet = new Set<string>();

  const map = new Map<string, {
    siteId: string;
    siteName: string;
    monthKey: string;
    monthLabel: string;
    year: number;
    month: number;
    warehouses: Set<string>;
    inboundQty: number;
    outboundQty: number;
    inboundTxCount: number;
    outboundTxCount: number;
    materialsMap: Map<string, SiteMonthlyMaterialBreakdown>;
    transactions: TransactionRecord[];
  }>();

  for (const row of records) {
    const rawSiteName = normalizeText(row.siteName);
    const rawSiteId = normalizeText(row.siteId);
    if (!rawSiteName && !rawSiteId) continue;
    if (rawSiteName === "-" && rawSiteId === "-") continue;

    const siteName = rawSiteName || rawSiteId;
    const siteId = rawSiteId && rawSiteId !== "-" ? rawSiteId : "-";

    const monthKey = getMonthKey(row.date);
    if (!monthKey) continue;

    const year = parseInt(monthKey.slice(0, 4), 10);
    const month = parseInt(monthKey.slice(5, 7), 10);

    const wh = normalizeText(row.whGci);
    if (wh) allWarehousesSet.add(wh);
    allMonthsSet.add(monthKey);
    allYearsSet.add(year);

    const type = normalizeType(row.transactionType);
    const includeTransfers = Boolean(options.includeTransfers);

    const isInbound = type === "INBOUND" || (includeTransfers && (type === "BORROW IN" || type === "TRANSFER IN"));
    const isOutbound = type === "OUTBOUND" || (includeTransfers && (type === "BORROW OUT" || type === "TRANSFER OUT"));

    if (!isInbound && !isOutbound) continue;

    // Filters before aggregation to maintain consistent filtered views
    if (options.warehouseFilter && options.warehouseFilter !== "ALL" && wh !== options.warehouseFilter) {
      continue;
    }
    if (options.yearFilter && options.yearFilter !== "ALL" && String(year) !== options.yearFilter) {
      continue;
    }
    if (options.monthFilter && options.monthFilter !== "ALL" && monthKey !== options.monthFilter) {
      continue;
    }

    const key = `${siteName}___${monthKey}`;
    if (!map.has(key)) {
      map.set(key, {
        siteId,
        siteName,
        monthKey,
        monthLabel: formatMonthIndonesian(monthKey),
        year,
        month,
        warehouses: new Set<string>(),
        inboundQty: 0,
        outboundQty: 0,
        inboundTxCount: 0,
        outboundTxCount: 0,
        materialsMap: new Map<string, SiteMonthlyMaterialBreakdown>(),
        transactions: [],
      });
    }

    const group = map.get(key)!;
    if (siteId !== "-" && group.siteId === "-") {
      group.siteId = siteId;
    }
    if (wh) group.warehouses.add(wh);
    group.transactions.push(row);

    const qty = Number(row.qty) || 0;
    const materialName = normalizeText(row.materialName) || "Material Tanpa Nama";
    const materialCode = normalizeText(row.materialCode) || "-";
    const unit = normalizeText(row.unit) || "Pcs";
    const matKey = `${materialName}___${unit}`;

    if (!group.materialsMap.has(matKey)) {
      group.materialsMap.set(matKey, {
        materialName,
        materialCode,
        unit,
        inboundQty: 0,
        outboundQty: 0,
        netQty: 0,
        inboundTxCount: 0,
        outboundTxCount: 0,
        totalTxCount: 0,
      });
    }

    const matItem = group.materialsMap.get(matKey)!;
    if (materialCode !== "-" && matItem.materialCode === "-") {
      matItem.materialCode = materialCode;
    }

    if (isInbound) {
      group.inboundQty += qty;
      group.inboundTxCount += 1;
      matItem.inboundQty += qty;
      matItem.inboundTxCount += 1;
    }
    if (isOutbound) {
      group.outboundQty += qty;
      group.outboundTxCount += 1;
      matItem.outboundQty += qty;
      matItem.outboundTxCount += 1;
    }

    matItem.netQty = matItem.outboundQty - matItem.inboundQty;
    matItem.totalTxCount = matItem.inboundTxCount + matItem.outboundTxCount;
  }

  // Convert to array and calculate netQty and totals
  let items: SiteMonthlyAggregate[] = Array.from(map.values()).map((entry) => {
    const materials = Array.from(entry.materialsMap.values()).sort(
      (a, b) => (b.outboundQty + b.inboundQty) - (a.outboundQty + a.inboundQty)
    );
    return {
      id: `${entry.siteName}___${entry.monthKey}`,
      siteId: entry.siteId,
      siteName: entry.siteName,
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel,
      year: entry.year,
      month: entry.month,
      warehouses: Array.from(entry.warehouses),
      inboundQty: entry.inboundQty,
      outboundQty: entry.outboundQty,
      netQty: entry.outboundQty - entry.inboundQty,
      inboundTxCount: entry.inboundTxCount,
      outboundTxCount: entry.outboundTxCount,
      totalTxCount: entry.inboundTxCount + entry.outboundTxCount,
      materials,
      transactions: entry.transactions,
    };
  });

  // Apply activity filter
  if (options.activityFilter && options.activityFilter !== "ALL") {
    if (options.activityFilter === "BOTH") {
      items = items.filter((item) => item.inboundQty > 0 && item.outboundQty > 0);
    } else if (options.activityFilter === "INBOUND_ONLY") {
      items = items.filter((item) => item.inboundQty > 0 && item.outboundQty === 0);
    } else if (options.activityFilter === "OUTBOUND_ONLY") {
      items = items.filter((item) => item.outboundQty > 0 && item.inboundQty === 0);
    }
  }

  // Apply search query
  if (options.searchQuery) {
    const q = normalizeText(options.searchQuery).toLowerCase();
    items = items.filter((item) => {
      if (item.siteName.toLowerCase().includes(q)) return true;
      if (item.siteId.toLowerCase().includes(q)) return true;
      if (item.monthLabel.toLowerCase().includes(q)) return true;
      if (item.monthKey.toLowerCase().includes(q)) return true;
      return item.materials.some(
        (m) =>
          m.materialName.toLowerCase().includes(q) ||
          m.materialCode.toLowerCase().includes(q)
      );
    });
  }

  // Sort default chronologically descending by monthKey, then alphabetically by siteName
  items.sort((a, b) => {
    const mCompare = b.monthKey.localeCompare(a.monthKey);
    if (mCompare !== 0) return mCompare;
    return a.siteName.localeCompare(b.siteName);
  });

  const totals = {
    uniqueSites: new Set(items.map((x) => x.siteName)).size,
    inboundQty: items.reduce((sum, x) => sum + x.inboundQty, 0),
    outboundQty: items.reduce((sum, x) => sum + x.outboundQty, 0),
    netQty: items.reduce((sum, x) => sum + x.netQty, 0),
    totalTxCount: items.reduce((sum, x) => sum + x.totalTxCount, 0),
  };

  const allMonths = Array.from(allMonthsSet).sort((a, b) => b.localeCompare(a));
  const allYears = Array.from(allYearsSet).sort((a, b) => b - a);
  const allWarehouses = Array.from(allWarehousesSet).sort((a, b) => a.localeCompare(b));

  return {
    items,
    allMonths,
    allYears,
    allWarehouses,
    totals,
  };
}
