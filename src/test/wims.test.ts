import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeType,
  compareText,
  asDateInput,
  currentTime,
  formatNumber,
  formatRowId,
  movementSign,
  transactionBucket,
  classifyLeftover,
  canAccessWarehouse,
  getAccessibleWarehouses,
  canTransactInWarehouse,
  getInTransitQty,
  getAvailableReels,
  calculateInventory,
} from "../lib/wims";
import type { MaterialItem, OpeningBalanceRecord, TransactionRecord, WarehouseTransferLine } from "../types";

describe("normalizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("  Hello   World  ")).toBe("Hello World");
  });

  it("replaces non-breaking spaces", () => {
    expect(normalizeText("Hello\u00a0World")).toBe("Hello World");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("normalizeType", () => {
  it("uppercases trimmed text", () => {
    expect(normalizeType("  inbound  ")).toBe("INBOUND");
  });
});

describe("compareText", () => {
  it("is case-insensitive", () => {
    expect(compareText("Malang", "malang")).toBe(true);
    expect(compareText("  ABC  ", "abc")).toBe(true);
  });
});

describe("asDateInput", () => {
  it("returns today when empty", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(asDateInput("")).toBe(today);
    expect(asDateInput(null)).toBe(today);
  });

  it("parses ISO date", () => {
    expect(asDateInput("2026-07-15T12:00:00Z")).toBe("2026-07-15");
  });
});

describe("currentTime", () => {
  it("returns HH:MM format", () => {
    const time = currentTime();
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatNumber", () => {
  it("formats numbers with 1 decimal", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatRowId", () => {
  it("pads to 3 digits", () => {
    expect(formatRowId(1)).toBe("001");
    expect(formatRowId(12)).toBe("012");
    expect(formatRowId(123)).toBe("123");
  });
});

describe("movementSign", () => {
  it("returns 1 for positive types", () => {
    expect(movementSign("INBOUND")).toBe(1);
    expect(movementSign("BORROW IN")).toBe(1);
    expect(movementSign("TRANSFER IN")).toBe(1);
  });

  it("returns -1 for negative types", () => {
    expect(movementSign("OUTBOUND")).toBe(-1);
    expect(movementSign("BORROW OUT")).toBe(-1);
    expect(movementSign("TRANSFER OUT")).toBe(-1);
  });

  it("returns 0 for unknown types", () => {
    expect(movementSign("UNKNOWN")).toBe(0);
    expect(movementSign(null)).toBe(0);
  });
});

describe("transactionBucket", () => {
  it("maps transaction types to inventory buckets", () => {
    expect(transactionBucket("INBOUND")).toBe("inboundCalc");
    expect(transactionBucket("OUTBOUND")).toBe("outboundCalc");
    expect(transactionBucket("TRANSFER IN")).toBe("transferInCalc");
    expect(transactionBucket("TRANSFER OUT")).toBe("transferOutCalc");
    expect(transactionBucket("BORROW IN")).toBe("borrowInCalc");
    expect(transactionBucket("BORROW OUT")).toBe("borrowOutCalc");
    expect(transactionBucket("UNKNOWN")).toBeNull();
  });
});

describe("classifyLeftover", () => {
  it("classifies by qty thresholds", () => {
    expect(classifyLeftover(2500)).toBe(">2000");
    expect(classifyLeftover(1750)).toBe(">1500");
    expect(classifyLeftover(1200)).toBe(">1000");
    expect(classifyLeftover(750)).toBe(">500");
    expect(classifyLeftover(300)).toBe(">250");
    expect(classifyLeftover(150)).toBe(">100");
    expect(classifyLeftover(50)).toBe("<100");
  });
});

describe("warehouse access and readiness", () => {
  const warehouses = [
    { whId: "W001", whGci: "EJ-Malang-01", picWh: null, operationalStatus: "OPERATIONAL" as const, historyComplete: true },
    { whId: "W002", whGci: "EJ-Gresik-01", picWh: null, operationalStatus: "SETUP" as const, historyComplete: false },
    { whId: "ALL", whGci: "ALL", picWh: null },
  ];

  it("limits staff to assigned warehouses while managers and admins can access all", () => {
    const staff = { id: "staff", email: "staff@example.com", role: "Staff Gudang" as const, warehouseAssignments: ["ej-malang-01"] };
    const manager = { id: "manager", email: "manager@example.com", role: "Manager" as const };

    expect(canAccessWarehouse(staff, "EJ-Malang-01")).toBe(true);
    expect(canAccessWarehouse(staff, "EJ-Gresik-01")).toBe(false);
    expect(getAccessibleWarehouses(warehouses, staff).map((warehouse) => warehouse.whGci)).toEqual(["EJ-Malang-01"]);
    expect(getAccessibleWarehouses(warehouses, manager)).toHaveLength(2);
  });

  it("allows transactions only after the warehouse is operational, independent of history completeness", () => {
    expect(canTransactInWarehouse(warehouses[0])).toBe(true);
    expect(canTransactInWarehouse(warehouses[1])).toBe(false);
    expect(canTransactInWarehouse(undefined)).toBe(false);
  });
});

describe("opening balance inventory cutoffs", () => {
  const material = {
    materialName: "Cable",
    inbound: 0,
    outbound: 0,
    transferIn: 0,
    transferOut: 0,
    borrowIn: 0,
    borrowOut: 0,
    stockWh: 0,
    leftoversStock: 0,
  } as MaterialItem;

  const transaction = (id: string, whGci: string, transactionType: string, date: string, qty: number, taggingType: "LOGFILE" | "LEFTOVERS" = "LOGFILE"): TransactionRecord => ({
    id,
    source: taggingType === "LEFTOVERS" ? "leftovers" : "logfile",
    rowId: id,
    lineId: null,
    taggingType,
    transactionType,
    notaNo: null,
    whGci,
    picWarehouse: null,
    date,
    time: null,
    sourceDestination: null,
    typeMaterial: null,
    materialName: "Cable",
    materialCode: null,
    unit: "Meter",
    qty,
    siteId: null,
    siteName: null,
    doNumber: null,
    dnNumber: null,
    condition: null,
    picDelivery: null,
    vendorSupplier: null,
    idCard: null,
    carPlate: null,
    remarks: null,
  });

  it("uses verified opening stock and ignores legacy movements through its effective date", () => {
    const openingBalances: OpeningBalanceRecord[] = [
      { id: "opening-main", warehouseGci: "Main", materialName: "Cable", qty: 80, taggingType: "LOGFILE", effectiveDate: "2026-05-31", status: "VERIFIED" },
      { id: "opening-leftover", warehouseGci: "Main", materialName: "Cable", qty: 12, taggingType: "LEFTOVERS", effectiveDate: "2026-05-31", status: "VERIFIED" },
    ];
    const inventory = calculateInventory(
      [material],
      [transaction("old-in", "Main", "INBOUND", "2026-05-30", 100), transaction("new-in", "Main", "INBOUND", "2026-06-01", 20)],
      [transaction("old-lo", "Main", "INBOUND", "2026-05-30", 30, "LEFTOVERS"), transaction("new-lo", "Main", "INBOUND", "2026-06-01", 5, "LEFTOVERS")],
      "Main",
      openingBalances,
    )[0];

    expect(inventory.stockWhCalc).toBe(100);
    expect(inventory.leftoversStockCalc).toBe(17);
    expect(inventory.openingStockCalc).toBe(80);
  });

  it("combines verified opening balances with ledger-only warehouses", () => {
    const openingBalances: OpeningBalanceRecord[] = [
      { id: "opening-main", warehouseGci: "Main", materialName: "Cable", qty: 80, taggingType: "LOGFILE", effectiveDate: "2026-05-31", status: "VERIFIED" },
    ];
    const inventory = calculateInventory(
      [material],
      [transaction("main-old", "Main", "INBOUND", "2026-05-30", 100), transaction("branch-in", "Branch", "INBOUND", "2026-05-30", 15)],
      [],
      "ALL",
      openingBalances,
    )[0];

    expect(inventory.stockWhCalc).toBe(95);
  });

  it("uses the latest opname as a reset instead of adding earlier opening counts", () => {
    const openingBalances: OpeningBalanceRecord[] = [
      { id: "opening-old", warehouseGci: "Main", materialName: "Cable", qty: 80, taggingType: "LOGFILE", effectiveDate: "2026-05-31", status: "VERIFIED" },
      { id: "opening-new", warehouseGci: "Main", materialName: "Cable", qty: 25, taggingType: "LOGFILE", effectiveDate: "2026-06-30", status: "VERIFIED" },
    ];
    const inventory = calculateInventory(
      [material],
      [transaction("between-counts", "Main", "INBOUND", "2026-06-15", 10), transaction("after-count", "Main", "INBOUND", "2026-07-01", 5)],
      [],
      "Main",
      openingBalances,
    )[0];

    expect(inventory.stockWhCalc).toBe(30);
    expect(inventory.openingStockCalc).toBe(25);
  });

  it("keeps regular stock and leftovers cutoffs independent", () => {
    const openingBalances: OpeningBalanceRecord[] = [
      { id: "opening-stock", warehouseGci: "Main", materialName: "Cable", qty: 25, taggingType: "LOGFILE", effectiveDate: "2026-05-31", status: "VERIFIED" },
      { id: "opening-lo", warehouseGci: "Main", materialName: "Cable", qty: 8, taggingType: "LEFTOVERS", effectiveDate: "2026-06-30", status: "VERIFIED" },
    ];
    const inventory = calculateInventory(
      [material],
      [transaction("stock-june", "Main", "INBOUND", "2026-06-15", 10)],
      [transaction("leftover-june", "Main", "INBOUND", "2026-06-15", 3, "LEFTOVERS")],
      "Main",
      openingBalances,
    )[0];

    expect(inventory.stockWhCalc).toBe(35);
    expect(inventory.leftoversStockCalc).toBe(8);
  });

  it("uses verified opening drum balances for FIFO and ignores pre-cutoff reel movements", () => {
    const openingBalances: OpeningBalanceRecord[] = [
      { id: "opening-drum", warehouseGci: "Main", materialName: "Cable", qty: 5, taggingType: "LOGFILE", drumNumber: "DRUM-1", effectiveDate: "2026-05-31", status: "VERIFIED" },
    ];
    const rows = [
      { ...transaction("legacy-in", "Main", "INBOUND", "2026-05-30", 10), drumNumber: "DRUM-1" },
      { ...transaction("legacy-out", "Main", "OUTBOUND", "2026-05-30", 10), drumNumber: "DRUM-1" },
      { ...transaction("current-out", "Main", "OUTBOUND", "2026-06-01", 2), drumNumber: "DRUM-1" },
    ];

    expect(getAvailableReels("Cable", "Main", "LOGFILE", rows, openingBalances)).toEqual([
      { drumNumber: "DRUM-1", taggingType: "LOGFILE", remaining: 3, date: "2026-05-31" },
    ]);
  });
});

describe("in-transit inventory", () => {
  const partialTransfer: WarehouseTransferLine = {
    id: "line-1",
    transferId: "transfer-1",
    sourceWarehouseGci: "Main",
    destinationWarehouseGci: "Branch",
    materialName: "Cable",
    qtySent: 10,
    qtyReceived: 3,
    qtyReturned: 1,
    qtyWrittenOff: 2,
  };

  it("tracks only unresolved quantities for the selected warehouse or combined view", () => {
    expect(getInTransitQty([partialTransfer], "Cable", "Main")).toBe(4);
    expect(getInTransitQty([partialTransfer], "Cable", "Branch")).toBe(4);
    expect(getInTransitQty([partialTransfer], "Cable", "ALL")).toBe(4);
    expect(getInTransitQty([partialTransfer], "Pole", "ALL")).toBe(0);
  });

  it("does not count in-transit goods as available stock", () => {
    const material = {
      materialName: "Cable",
      inbound: 0,
      outbound: 0,
      transferIn: 0,
      transferOut: 0,
      borrowIn: 0,
      borrowOut: 0,
      stockWh: 0,
      leftoversStock: 0,
    } as MaterialItem;
    const inventory = calculateInventory([material], [], [], "ALL", [], [partialTransfer])[0];

    expect(inventory.inTransitCalc).toBe(4);
    expect(inventory.stockWhCalc).toBe(0);
  });
});
