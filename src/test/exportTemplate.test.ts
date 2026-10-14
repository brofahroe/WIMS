import { describe, it, expect } from "vitest";
import {
  EXPORT_TEMPLATE_COLUMNS,
  type MaterialItem,
  type SiteItem,
  type TransactionRecord,
} from "../types";
import {
  exportTemplateRowsToAoa,
  resolveCluster,
  resolveDriverInfo,
  resolveSumberMaterial,
  resolveWarehouseOriginDestination,
  transformToExportTemplateRow,
} from "../lib/exportTemplate";

describe("Export Template Columns Definition", () => {
  it("matches the exact 15 columns and order requested by user", () => {
    const expected = [
      "Tipe Transaksi",
      "Tanggal",
      "Gudang Asal",
      "Gudang Tujuan",
      "Cluster",
      "Sumber Material",
      "No Transaksi / Group ID",
      "No DO",
      "No DN",
      "Nama Driver",
      "No HP Driver",
      "Kode Material",
      "Nama Material",
      "Qty",
      "Kondisi",
    ];

    expect(EXPORT_TEMPLATE_COLUMNS).toHaveLength(15);
    expect([...EXPORT_TEMPLATE_COLUMNS]).toEqual(expected);
  });
});

describe("resolveWarehouseOriginDestination", () => {
  const baseRecord: TransactionRecord = {
    id: "tx-1",
    source: "logfile",
    rowId: "1",
    lineId: 1,
    taggingType: "LOGFILE",
    transactionType: "INBOUND",
    notaNo: "INB-001",
    whGci: "EJ-Malang-01",
    picWarehouse: "PIC WH",
    date: "2024-05-10",
    time: "10:00",
    sourceDestination: "ZTE Warehouse",
    typeMaterial: "ZTE Material",
    materialName: "ADSS 24C",
    materialCode: "ZTE2001",
    unit: "Meter",
    qty: 3000,
    siteId: "CLR51-01",
    siteName: "Site Alpha",
    doNumber: "DO-123",
    dnNumber: "DN-456",
    condition: "Good",
    picDelivery: "Pak Budi",
    vendorSupplier: "PT Supplier",
    idCard: "",
    carPlate: "N 1234 AB",
    remarks: "Pengiriman pertama",
  };

  it("handles INBOUND: origin is sourceDestination, destination is whGci", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "INBOUND",
      sourceDestination: "ZTE Warehouse",
      whGci: "EJ-Malang-01",
    });
    expect(result.gudangAsal).toBe("ZTE Warehouse");
    expect(result.gudangTujuan).toBe("EJ-Malang-01");
  });

  it("handles OUTBOUND: origin is whGci, destination is siteName / siteId", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "OUTBOUND",
      whGci: "EJ-Malang-01",
      siteName: "Site Alpha Singosari",
    });
    expect(result.gudangAsal).toBe("EJ-Malang-01");
    expect(result.gudangTujuan).toBe("Site Alpha Singosari");
  });

  it("handles TRANSFER OUT: origin is whGci, destination is destinationWarehouseGci", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "TRANSFER OUT",
      whGci: "EJ-Malang-01",
      destinationWarehouseGci: "EJ-Surabaya-01",
    });
    expect(result.gudangAsal).toBe("EJ-Malang-01");
    expect(result.gudangTujuan).toBe("EJ-Surabaya-01");
  });

  it("handles TRANSFER IN: origin is sourceWarehouseGci, destination is whGci", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "TRANSFER IN",
      sourceWarehouseGci: "EJ-Surabaya-01",
      whGci: "EJ-Malang-01",
    });
    expect(result.gudangAsal).toBe("EJ-Surabaya-01");
    expect(result.gudangTujuan).toBe("EJ-Malang-01");
  });

  it("handles BORROW IN: origin is lender/sourceDestination, destination is whGci", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "BORROW IN",
      sourceDestination: "Subcon Morasha",
      whGci: "EJ-Malang-01",
    });
    expect(result.gudangAsal).toBe("Subcon Morasha");
    expect(result.gudangTujuan).toBe("EJ-Malang-01");
  });

  it("handles BORROW OUT: origin is whGci, destination is borrower", () => {
    const result = resolveWarehouseOriginDestination({
      ...baseRecord,
      transactionType: "BORROW OUT",
      whGci: "EJ-Malang-01",
      sourceDestination: "Subcon Morasha",
    });
    expect(result.gudangAsal).toBe("EJ-Malang-01");
    expect(result.gudangTujuan).toBe("Subcon Morasha");
  });
});

describe("resolveCluster", () => {
  const dummyTx: TransactionRecord = {
    id: "tx-2",
    source: "logfile",
    rowId: "1",
    lineId: 1,
    taggingType: "LOGFILE",
    transactionType: "OUTBOUND",
    notaNo: "OUB-01",
    whGci: "EJ-Malang-01",
    picWarehouse: null,
    date: "2024-05-10",
    time: null,
    sourceDestination: null,
    typeMaterial: null,
    materialName: "Pole 7M",
    materialCode: "ZTE1001",
    unit: "Pcs",
    qty: 10,
    siteId: "CLR51-02-014",
    siteName: "Dusun Klampok",
    doNumber: null,
    dnNumber: null,
    condition: null,
    picDelivery: null,
    vendorSupplier: null,
    idCard: null,
    carPlate: null,
    remarks: null,
  };

  it("returns explicit cluster if present on record", () => {
    expect(resolveCluster({ ...dummyTx, cluster: "Cluster A-1" })).toBe("Cluster A-1");
  });

  it("identifies cluster code starting with CLR", () => {
    expect(resolveCluster(dummyTx)).toBe("CLR51-02-014");
  });

  it("extracts cluster from remarks if mentioned", () => {
    const tx = { ...dummyTx, siteId: "MF51-01", remarks: "Cluster klampok 17fat 2750, sisa 250" };
    expect(resolveCluster(tx)).toBe("Cluster klampok 17fat 2750");
  });

  it("resolves from SiteItem if record has no CLR prefix", () => {
    const site: SiteItem = {
      siteId: "CLR51-99-004",
      siteName: "Perumahan Bumi Podo Rukun",
      region: "East Java",
      city: "Malang",
      address: null,
      team: "Guruh",
      permit: null,
      snd: null,
      donation: null,
      implementation: null,
      atp: null,
      acceptance: null,
      finalMilestone: null,
      materialRequest: null,
      milestoneByZte: null,
      projectName: null,
      statusCity: null,
      no: 1,
      materials: {},
    };
    const tx = { ...dummyTx, siteId: "MF51-01", remarks: null };
    expect(resolveCluster(tx, site)).toBe("CLR51-99-004");
  });
});

describe("resolveDriverInfo", () => {
  const dummyTx: TransactionRecord = {
    id: "tx-3",
    source: "logfile",
    rowId: "1",
    lineId: 1,
    taggingType: "LOGFILE",
    transactionType: "OUTBOUND",
    notaNo: "OUB-01",
    whGci: "EJ-Malang-01",
    picWarehouse: null,
    date: "2024-05-10",
    time: null,
    sourceDestination: null,
    typeMaterial: null,
    materialName: "Pole 7M",
    materialCode: "ZTE1001",
    unit: "Pcs",
    qty: 10,
    siteId: "CLR51-02-014",
    siteName: "Dusun Klampok",
    doNumber: null,
    dnNumber: null,
    condition: null,
    picDelivery: "Riki Romansyah",
    vendorSupplier: null,
    idCard: null,
    carPlate: null,
    remarks: null,
  };

  it("extracts clean driver name", () => {
    const res = resolveDriverInfo(dummyTx);
    expect(res.namaDriver).toBe("Riki Romansyah");
    expect(res.noHpDriver).toBe("");
  });

  it("extracts phone when embedded in picDelivery", () => {
    const res = resolveDriverInfo({ ...dummyTx, picDelivery: "Riki Romansyah - 081234567890" });
    expect(res.namaDriver).toBe("Riki Romansyah");
    expect(res.noHpDriver).toBe("081234567890");
  });

  it("extracts explicit driverPhone", () => {
    const res = resolveDriverInfo({ ...dummyTx, driverPhone: "08987654321" });
    expect(res.namaDriver).toBe("Riki Romansyah");
    expect(res.noHpDriver).toBe("08987654321");
  });

  it("extracts driver phone from remarks if present", () => {
    const res = resolveDriverInfo({ ...dummyTx, remarks: "Driver kontak: 085712349999 armada truk" });
    expect(res.namaDriver).toBe("Riki Romansyah");
    expect(res.noHpDriver).toBe("085712349999");
  });
});

describe("transformToExportTemplateRow & exportTemplateRowsToAoa", () => {
  const dummyMaterial: MaterialItem = {
    rowId: "1",
    typeMaterial: "ZTE Material",
    sourceMaterial: "ZTE Warehouse",
    materialCode: "ZTE2001",
    materialName: "ADSS 24C",
    unit: "Meter",
    inbound: 0,
    outbound: 0,
    transferIn: 0,
    transferOut: 0,
    borrowIn: 0,
    borrowOut: 0,
    stockWh: 0,
    leftoversStock: 0,
    addRemark: null,
  };

  const dummyTx: TransactionRecord = {
    id: "tx-4",
    source: "logfile",
    rowId: "1",
    lineId: 1,
    taggingType: "LOGFILE",
    transactionType: "OUTBOUND",
    notaNo: "OUB-W001-2024-001",
    whGci: "EJ-Malang-01",
    picWarehouse: null,
    date: "2024-06-15T08:30:00Z",
    time: "08:30",
    sourceDestination: "EJ-Malang-01",
    typeMaterial: "ZTE Material",
    materialName: "ADSS 24C",
    materialCode: "ZTE2001",
    unit: "Meter",
    qty: 2500,
    siteId: "CLR51-02-014",
    siteName: "Site Wagir RW 03",
    doNumber: "DOEID240601",
    dnNumber: "DNWID012406",
    condition: "Good",
    picDelivery: "Slamet - 081233445566",
    vendorSupplier: "PT Partner",
    idCard: "350700000000",
    carPlate: "N 5678 CD",
    remarks: "Pengiriman kabel",
  };

  it("transforms record into complete ExportTemplateRow", () => {
    const row = transformToExportTemplateRow(dummyTx, [dummyMaterial], []);

    expect(row.transactionType).toBe("OUTBOUND");
    expect(row.date).toBe("2024-06-15");
    expect(row.gudangAsal).toBe("EJ-Malang-01");
    expect(row.gudangTujuan).toBe("Site Wagir RW 03");
    expect(row.cluster).toBe("CLR51-02-014");
    expect(row.sumberMaterial).toBe("ZTE Warehouse");
    expect(row.noTransaksi).toBe("OUB-W001-2024-001");
    expect(row.noDo).toBe("DOEID240601");
    expect(row.noDn).toBe("DNWID012406");
    expect(row.namaDriver).toBe("Slamet");
    expect(row.noHpDriver).toBe("081233445566");
    expect(row.kodeMaterial).toBe("ZTE2001");
    expect(row.namaMaterial).toBe("ADSS 24C");
    expect(row.qty).toBe(2500);
    expect(row.kondisi).toBe("Good");
  });

  it("formats AOA matching header sequence", () => {
    const row = transformToExportTemplateRow(dummyTx, [dummyMaterial], []);
    const aoa = exportTemplateRowsToAoa([row]);

    expect(aoa).toHaveLength(2);
    expect(aoa[0]).toEqual([...EXPORT_TEMPLATE_COLUMNS]);
    expect(aoa[1]).toEqual([
      "OUTBOUND",
      "2024-06-15",
      "EJ-Malang-01",
      "Site Wagir RW 03",
      "CLR51-02-014",
      "ZTE Warehouse",
      "OUB-W001-2024-001",
      "DOEID240601",
      "DNWID012406",
      "Slamet",
      "081233445566",
      "ZTE2001",
      "ADSS 24C",
      2500,
      "Good",
    ]);
  });
});
