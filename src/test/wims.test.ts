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
  getMonthKey,
  formatMonthIndonesian,
  formatMonthShort,
  aggregateSiteMonthly,
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

describe("Monthly Site Summary Helpers", () => {
  it("extracts month key correctly", () => {
    expect(getMonthKey("2024-10-23T00:00:00.000Z")).toBe("2024-10");
    expect(getMonthKey("2026-05-12")).toBe("2026-05");
    expect(getMonthKey("")).toBe("");
    expect(getMonthKey(null)).toBe("");
  });

  it("formats month names in Indonesian correctly", () => {
    expect(formatMonthIndonesian("2024-10")).toBe("Oktober 2024");
    expect(formatMonthIndonesian("2025-01")).toBe("Januari 2025");
    expect(formatMonthShort("2024-10")).toBe("Okt '24");
    expect(formatMonthIndonesian("invalid")).toBe("invalid");
  });

  it("aggregates inbound and outbound per site name and per month", () => {
    const mockRows: TransactionRecord[] = [
      {
        id: "1",
        source: "logfile",
        rowId: "001",
        lineId: 1,
        taggingType: "LOGFILE",
        transactionType: "INBOUND",
        notaNo: "INB-01",
        whGci: "EJ-Malang-01",
        picWarehouse: "PIC",
        date: "2024-10-15",
        time: "10:00",
        sourceDestination: "Supplier",
        typeMaterial: "Fiber",
        materialName: "Kabel FO 24C",
        materialCode: "CBL-24C",
        unit: "Meter",
        qty: 1000,
        siteId: "SITE-001",
        siteName: "Site Singosari",
        doNumber: null,
        dnNumber: null,
        condition: "Good",
        picDelivery: null,
        vendorSupplier: null,
        idCard: null,
        carPlate: null,
        remarks: null,
      },
      {
        id: "2",
        source: "logfile",
        rowId: "002",
        lineId: 2,
        taggingType: "LOGFILE",
        transactionType: "OUTBOUND",
        notaNo: "OUB-01",
        whGci: "EJ-Malang-01",
        picWarehouse: "PIC",
        date: "2024-10-20",
        time: "11:00",
        sourceDestination: "Site",
        typeMaterial: "Fiber",
        materialName: "Kabel FO 24C",
        materialCode: "CBL-24C",
        unit: "Meter",
        qty: 1500,
        siteId: "SITE-001",
        siteName: "Site Singosari",
        doNumber: null,
        dnNumber: null,
        condition: "Good",
        picDelivery: null,
        vendorSupplier: null,
        idCard: null,
        carPlate: null,
        remarks: null,
      },
      {
        id: "3",
        source: "logfile",
        rowId: "003",
        lineId: 3,
        taggingType: "LOGFILE",
        transactionType: "OUTBOUND",
        notaNo: "OUB-02",
        whGci: "EJ-Malang-01",
        picWarehouse: "PIC",
        date: "2024-11-05",
        time: "09:00",
        sourceDestination: "Site",
        typeMaterial: "Fiber",
        materialName: "Kabel FO 24C",
        materialCode: "CBL-24C",
        unit: "Meter",
        qty: 500,
        siteId: "SITE-001",
        siteName: "Site Singosari",
        doNumber: null,
        dnNumber: null,
        condition: "Good",
        picDelivery: null,
        vendorSupplier: null,
        idCard: null,
        carPlate: null,
        remarks: null,
      },
      {
        id: "4",
        source: "logfile",
        rowId: "004",
        lineId: 4,
        taggingType: "LOGFILE",
        transactionType: "OUTBOUND",
        notaNo: "OUB-03",
        whGci: "EJ-Kediri-01",
        picWarehouse: "PIC",
        date: "2024-10-18",
        time: "14:00",
        sourceDestination: "Site",
        typeMaterial: "Aksesoris",
        materialName: "ODP 8 Port",
        materialCode: "ODP-08",
        unit: "Pcs",
        qty: 10,
        siteId: "SITE-002",
        siteName: "Site Batu",
        doNumber: null,
        dnNumber: null,
        condition: "Good",
        picDelivery: null,
        vendorSupplier: null,
        idCard: null,
        carPlate: null,
        remarks: null,
      },
      {
        // Row without site should be skipped
        id: "5",
        source: "logfile",
        rowId: "005",
        lineId: 5,
        taggingType: "LOGFILE",
        transactionType: "OUTBOUND",
        notaNo: "OUB-04",
        whGci: "EJ-Malang-01",
        picWarehouse: "PIC",
        date: "2024-10-25",
        time: "15:00",
        sourceDestination: "General",
        typeMaterial: "General",
        materialName: "Tools",
        materialCode: "TLS",
        unit: "Pcs",
        qty: 2,
        siteId: null,
        siteName: null,
        doNumber: null,
        dnNumber: null,
        condition: "Good",
        picDelivery: null,
        vendorSupplier: null,
        idCard: null,
        carPlate: null,
        remarks: null,
      },
    ];

    const result = aggregateSiteMonthly(mockRows);

    expect(result.allMonths).toEqual(["2024-11", "2024-10"]);
    expect(result.allYears).toEqual([2024]);
    expect(result.allWarehouses).toEqual(["EJ-Kediri-01", "EJ-Malang-01"]);
    expect(result.totals.uniqueSites).toBe(2);
    expect(result.totals.inboundQty).toBe(1000);
    expect(result.totals.outboundQty).toBe(2010);
    expect(result.totals.netQty).toBe(1010);

    // Filter by site and month
    const singosariOct = result.items.find(
      (x) => x.siteName === "Site Singosari" && x.monthKey === "2024-10"
    );
    expect(singosariOct).toBeDefined();
    expect(singosariOct?.inboundQty).toBe(1000);
    expect(singosariOct?.outboundQty).toBe(1500);
    expect(singosariOct?.netQty).toBe(500);
    expect(singosariOct?.inboundTxCount).toBe(1);
    expect(singosariOct?.outboundTxCount).toBe(1);
    expect(singosariOct?.totalTxCount).toBe(2);
    expect(singosariOct?.materials).toHaveLength(1);
    expect(singosariOct?.materials[0].materialName).toBe("Kabel FO 24C");

    // Filter by year
    const filtered2024 = aggregateSiteMonthly(mockRows, { yearFilter: "2024" });
    expect(filtered2024.items.length).toBe(3);

    // Filter by warehouse
    const kediriOnly = aggregateSiteMonthly(mockRows, { warehouseFilter: "EJ-Kediri-01" });
    expect(kediriOnly.items.length).toBe(1);
    expect(kediriOnly.items[0].siteName).toBe("Site Batu");

    // Filter activity: both inbound and outbound
    const bothActivity = aggregateSiteMonthly(mockRows, { activityFilter: "BOTH" });
    expect(bothActivity.items.length).toBe(1);
    expect(bothActivity.items[0].siteName).toBe("Site Singosari");
  });
});

