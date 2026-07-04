import fs from "fs";
import xlsx from "xlsx";
import path from "path";
import crypto from "crypto";

const EXCEL_FILE = "WIMS V1_GCI-EJ-EMR-MALANG.xlsm";
const JSON_FILE = path.join("src", "data", "seedData.json");

function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === "string") return excelDate;
  if (typeof excelDate === "number") {
    // Excel base date is Dec 30, 1899
    const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return d.toISOString();
  }
  return null;
}

function processLogfile(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4); // Skip header and spacing
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[2]) continue; // Skip empty rows or missing transaction type

    const record = {
      id: crypto.randomUUID(),
      rowId: String(row[0] || ""),
      lineId: Number(row[1]) || null,
      transactionType: row[2] || null,
      notaNo: row[3] || null,
      whGci: row[4] || null,
      picWarehouse: row[5] || null,
      date: excelDateToJSDate(row[6]),
      time: String(row[7] || ""),
      sourceDestination: row[8] || null,
      typeMaterial: row[9] || null,
      materialName: row[10] || null,
      materialCode: row[11] || null,
      unit: row[12] || null,
      qty: Number(row[13]) || 0,
      siteId: row[14] || null,
      siteName: row[15] || null,
      doNumber: row[16] || null,
      dnNumber: row[17] || null,
      condition: row[18] || null,
      picDelivery: row[19] || null,
      vendorSupplier: row[20] || null,
      idCard: String(row[21] || ""),
      carPlate: String(row[22] || ""),
      remarks: row[23] || null,
      taggingType: "LOGFILE"
    };
    records.push(record);
  }
  return records;
}

function processLOLogfile(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[3]) continue; // Missing transaction type

    const record = {
      id: crypto.randomUUID(),
      rowId: String(row[0] || ""),
      tagId: String(row[1] || ""),
      lineId: Number(row[2]) || null,
      transactionType: row[3] || null,
      notaNo: row[4] || null,
      whGci: row[5] || null,
      picWarehouse: row[6] || null,
      date: excelDateToJSDate(row[7]),
      time: String(row[8] || ""),
      sourceDestination: row[9] || null,
      typeMaterial: row[10] || null,
      materialName: row[11] || null,
      materialCode: row[12] || null,
      unit: row[13] || null,
      qty: Number(row[14]) || 0,
      siteId: row[15] || null,
      siteName: row[16] || null,
      doNumber: row[17] || null,
      dnNumber: row[18] || null,
      condition: row[19] || null,
      picDelivery: row[20] || null,
      vendorSupplier: row[21] || null,
      idCard: String(row[22] || ""),
      carPlate: String(row[23] || ""),
      remarks: row[24] || null,
      taggingManual: row[25] || null,
      cableLengthMarker: row[26] || null,
      cableRoll: row[27] || null,
      taggingType: "LEFTOVERS"
    };
    records.push(record);
  }
  return records;
}

function processDeliveryOrders(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[0]) continue; // Missing SiteID

    const record = {
      siteId: row[0] || null,
      siteName: row[1] || null,
      subcon: row[2] || null,
      region: row[3] || null,
      city: row[4] || null,
      dropCity: row[5] || null,
      doNumber: row[6] || null,
      dnNumber: row[7] || null,
      materialPickUpdate: excelDateToJSDate(row[8]),
      materialName: row[9] || null,
      qty: Number(row[10]) || 0,
    };
    records.push(record);
  }
  return records;
}

function main() {
  console.log("Membaca file Excel...");
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error("File Excel tidak ditemukan:", EXCEL_FILE);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_FILE);
  
  if (!wb.Sheets["Logfile"] || !wb.Sheets["LO_Logfile"]) {
    console.error("Format Excel tidak sesuai. Sheet Logfile atau LO_Logfile tidak ditemukan.");
    process.exit(1);
  }

  console.log("Memproses Logfile...");
  const logRows = processLogfile(wb.Sheets["Logfile"]);
  console.log(`Berhasil memproses ${logRows.length} baris Logfile.`);

  console.log("Memproses LO_Logfile...");
  const leftoverRows = processLOLogfile(wb.Sheets["LO_Logfile"]);
  console.log(`Berhasil memproses ${leftoverRows.length} baris Leftovers.`);

  let deliveryOrders = null;
  if (wb.Sheets["DO_DB"]) {
    console.log("Memproses DO_DB...");
    deliveryOrders = processDeliveryOrders(wb.Sheets["DO_DB"]);
    console.log(`Berhasil memproses ${deliveryOrders.length} baris Delivery Orders.`);
  }

  console.log("Membaca data seed saat ini...");
  if (!fs.existsSync(JSON_FILE)) {
    console.error("File JSON tidak ditemukan:", JSON_FILE);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(JSON_FILE, "utf8");
  const seedData = JSON.parse(rawJson);

  // Update only the transaction logs and DO
  seedData.logRows = logRows;
  seedData.leftoverRows = leftoverRows;
  if (deliveryOrders) {
    seedData.deliveryOrders = deliveryOrders;
  }
  seedData.generatedAt = new Date().toISOString();

  console.log("Menyimpan perubahan ke seedData.json...");
  fs.writeFileSync(JSON_FILE, JSON.stringify(seedData, null, 2), "utf8");

  console.log("Sinkronisasi Selesai! Web App akan menggunakan data terbaru.");
}

main();
