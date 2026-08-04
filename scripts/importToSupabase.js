import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const EXCEL_FILE = "WIMS V1_GCI-EJ-EMR-MALANG.xlsm";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan di .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === "string") return excelDate;
  if (typeof excelDate === "number") {
    const d = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
    return d.toISOString();
  }
  return null;
}

function processLogfile(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[2]) continue;
    records.push({
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
      drumNumber: row[24] ? String(row[24]) : null,
      taggingType: "LOGFILE",
      source: "logfile",
      approvalStatus: "APPROVED",
      approvedBy: null,
      approvedAt: null,
      deletedAt: null,
    });
  }
  return records;
}

function processLOLogfile(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[3]) continue;
    records.push({
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
      cableLengthMarker: null,
      drumNumber: row[25] ? String(row[25]) : null,
      cableRoll: row[25] ? String(row[25]) : null,
      inOutQty: 0,
      loCriteria: null,
      taggingType: "LEFTOVERS",
      source: "leftovers",
      approvalStatus: "APPROVED",
      approvedBy: null,
      approvedAt: null,
      deletedAt: null,
    });
  }
  return records;
}

function processSiteDB(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[3]) continue;
    records.push({
      siteId: String(row[3] || "").trim(),
      siteName: String(row[4] || "").trim(),
      city: String(row[2] || "").trim(),
      region: String(row[1] || "").trim(),
      team: String(row[7] || "").trim(),
      finalMilestone: String(row[21] || "").trim(),
    });
  }
  return records;
}

function processDeliveryOrders(sheet) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const rows = data.slice(4);
  const records = [];

  for (const row of rows) {
    if (!row || row.length === 0 || !row[0]) continue;
    records.push({
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
    });
  }
  return records;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  console.log("Membaca file Excel...");
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error("File Excel tidak ditemukan:", EXCEL_FILE);
    process.exit(1);
  }

  const wb = xlsx.readFile(EXCEL_FILE);
  console.log("Sheet tersedia:", wb.SheetNames.join(", "));

  console.log("Memproses Logfile...");
  const logRows = processLogfile(wb.Sheets["Logfile"]);
  console.log(`Berhasil memproses ${logRows.length} baris Logfile.`);

  console.log("Memproses LO_Logfile...");
  const leftoverRows = processLOLogfile(wb.Sheets["LO_Logfile"]);
  console.log(`Berhasil memproses ${leftoverRows.length} baris Leftovers.`);

  let deliveryOrders = [];
  if (wb.Sheets["DO_DB"]) {
    console.log("Memproses DO_DB...");
    deliveryOrders = processDeliveryOrders(wb.Sheets["DO_DB"]);
    console.log(`Berhasil memproses ${deliveryOrders.length} baris Delivery Orders.`);
  }

  let sites = [];
  if (wb.Sheets["Site_DB"]) {
    console.log("Memproses Site_DB...");
    sites = processSiteDB(wb.Sheets["Site_DB"]);
    console.log(`Berhasil memproses ${sites.length} baris Site DB.`);
  }

  console.log("\n⚠️  WARNING: Semua data yang ada di Supabase akan dihapus!");
  console.log("   - transactions");
  console.log("   - audit_trail");
  console.log("   - master_materials");
  console.log("   - warehouses");
  console.log("   - sites");
  console.log("   - delivery_orders");
  console.log("   - app_settings");

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question("\nLanjutkan? (y/N): ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("Import dibatalkan.");
    process.exit(0);
  }

  console.log("\n🗑️  Menghapus data lama di Supabase...");

  const { error: delTxError } = await supabase.from("transactions").delete().neq("id", "");
  if (delTxError) console.error("Error deleting transactions:", delTxError.message);
  else console.log("  ✓ Transactions dibersihkan");

  const { error: delAuditError } = await supabase.from("audit_trail").delete().neq("id", "");
  if (delAuditError) console.error("Error deleting audit_trail:", delAuditError.message);
  else console.log("  ✓ Audit trail dibersihkan");

  const { error: delMatError } = await supabase.from("master_materials").delete().neq("materialName", "");
  if (delMatError) console.error("Error deleting master_materials:", delMatError.message);
  else console.log("  ✓ Master materials dibersihkan");

  const { error: delWhError } = await supabase.from("warehouses").delete().neq("whGci", "");
  if (delWhError) console.error("Error deleting warehouses:", delWhError.message);
  else console.log("  ✓ Warehouses dibersihkan");

  const { error: delSiteError } = await supabase.from("sites").delete().neq("siteId", "");
  if (delSiteError) console.error("Error deleting sites:", delSiteError.message);
  else console.log("  ✓ Sites dibersihkan");

  const { error: delDoError } = await supabase.from("delivery_orders").delete().neq("doNumber", "");
  if (delDoError) console.error("Error deleting delivery_orders:", delDoError.message);
  else console.log("  ✓ Delivery orders dibersihkan");

  const { error: delSettingsError } = await supabase.from("app_settings").delete().eq("id", "master");
  if (delSettingsError) console.error("Error deleting app_settings:", delSettingsError.message);
  else console.log("  ✓ App settings dibersihkan");

  console.log("\n📥 Import data ke Supabase...");

  const allTransactions = [...logRows, ...leftoverRows];
  let inserted = 0;
  for (const chunk of chunkArray(allTransactions, 500)) {
    const { error } = await supabase.from("transactions").insert(chunk);
    if (error) {
      console.error("Error inserting transactions (chunk):", error.message);
    } else {
      inserted += chunk.length;
    }
  }
  console.log(`  ✓ Transactions: ${inserted}/${allTransactions.length} berhasil diimport`);

  let materialsInserted = 0;
  const seedJson = JSON.parse(fs.readFileSync(path.join("src", "data", "seedData.json"), "utf8"));
  const materials = seedJson.master?.masterMaterials || [];
  for (const chunk of chunkArray(materials, 500)) {
    const { error } = await supabase.from("master_materials").insert(chunk);
    if (error) {
      console.error("Error inserting master_materials (chunk):", error.message);
    } else {
      materialsInserted += chunk.length;
    }
  }
  console.log(`  ✓ Master materials: ${materialsInserted} berhasil diimport`);

  let whsInserted = 0;
  const warehouses = seedJson.master?.warehouses || [];
  for (const chunk of chunkArray(warehouses, 500)) {
    const { error } = await supabase.from("warehouses").insert(chunk);
    if (error) {
      console.error("Error inserting warehouses (chunk):", error.message);
    } else {
      whsInserted += chunk.length;
    }
  }
  console.log(`  ✓ Warehouses: ${whsInserted} berhasil diimport`);

  let sitesInserted = 0;
  const sitesData = sites || seedJson.sites || [];
  for (const chunk of chunkArray(sitesData, 500)) {
    const { error } = await supabase.from("sites").insert(chunk);
    if (error) {
      console.error("Error inserting sites (chunk):", error.message);
    } else {
      sitesInserted += chunk.length;
    }
  }
  console.log(`  ✓ Sites: ${sitesInserted} berhasil diimport`);

  let doInserted = 0;
  const doData = deliveryOrders.length > 0 ? deliveryOrders : seedJson.deliveryOrders || [];
  for (const chunk of chunkArray(doData, 500)) {
    const { error } = await supabase.from("delivery_orders").insert(chunk);
    if (error) {
      console.error("Error inserting delivery_orders (chunk):", error.message);
    } else {
      doInserted += chunk.length;
    }
  }
  console.log(`  ✓ Delivery orders: ${doInserted} berhasil diimport`);

  const { error: settingsError } = await supabase.from("app_settings").upsert({
    id: "master",
    data: seedJson.master,
  });
  if (settingsError) console.error("Error inserting app_settings:", settingsError.message);
  else console.log("  ✓ App settings berhasil diimport");

  console.log("\n✅ Import selesai! Data telah siap di Supabase.");
  console.log("   Restart aplikasi dan klik 'Reset DB' untuk refresh data.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
