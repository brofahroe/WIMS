import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const EXCEL_FILE = "WIMS V1_GCI-EJ-EMR-MALANG.xlsm";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("VITE_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY tidak ditemukan di .env");
  process.exit(1);
}

// If you don't have SUPABASE_SERVICE_ROLE_KEY in .env, the script will use
// SECURITY DEFINER functions from supabase_import_function.sql. Run that SQL
// first in your Supabase SQL Editor, then re-run this script.

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: { schema: "public" },
  global: { db: { schema: "public" } },
});

// If we have the service_role key, we can bypass RLS directly.
// Otherwise, we rely on SECURITY DEFINER functions defined in supabase_import_function.sql.
const useServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const generateSqlMode = process.argv.includes("--sql");

const deletePatterns = {
  transactions: { col: "id", op: "neq", val: "" },
  audit_trail: { col: "id", op: "neq", val: "" },
  master_materials: { col: "materialName", op: "neq", val: "" },
  warehouses: { col: "whGci", op: "neq", val: "" },
  sites: { col: "siteId", op: "neq", val: "" },
  delivery_orders: { col: "doNumber", op: "neq", val: "" },
  app_settings: { col: "id", op: "eq", val: "master" },
};

async function truncateTable(table) {
  if (useServiceRole) {
    const pat = deletePatterns[table] || { col: "id", op: "neq", val: "" };
    let query = supabase.from(table).delete();
    if (pat.op === "neq") query = query.neq(pat.col, pat.val);
    else if (pat.op === "eq") query = query.eq(pat.col, pat.val);
    const { error } = await query;
    if (error) throw new Error(`Error deleting from ${table}: ${error.message}`);
  } else {
    const { error } = await supabase.rpc("bulk_truncate", { table_name: table });
    if (error) throw new Error(`Error truncating ${table}: ${error.message}`);
  }
}

async function insertChunk(table, rpcFunc, chunk) {
  if (generateSqlMode) {
    return { error: null, count: 0, sql: generateInsertSQL(table, chunk) };
  }
  if (useServiceRole) {
    const { error } = await supabase.from(table).insert(chunk);
    return { error: error || null, count: error ? 0 : chunk.length };
  } else {
    const { error, data } = await supabase.rpc(rpcFunc, { rows: chunk });
    if (error) return { error, count: 0 };
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return { error: parsed?.error || null, count: parsed?.inserted || 0 };
  }
}

function sqlEscape(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "object") return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
  return "'" + String(val).replace(/'/g, "''") + "'";
}

function generateInsertSQL(table, rows) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  const values = rows
    .map(row => "(" + cols.map(c => sqlEscape(row[c])).join(", ") + ")")
    .join(",\n");
  return `INSERT INTO public."${table}" (${colList}) VALUES\n${values};\n`;
}

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
      approval_status: "APPROVED",
      approved_by: null,
      approved_at: null,
      deleted_at: null,
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
      remarks: String(row[24] || ""),
      taggingManual: row[29] || null,
      cableLengthMarker: row[26] || null,
      drumNumber: row[25] ? String(row[25]) : null,
      cableRoll: null,
      inOutQty: Number(row[27]) || 0,
      loCriteria: row[28] || null,
      loCriteria: null,
      taggingType: "LEFTOVERS",
      source: "leftovers",
      approval_status: "APPROVED",
      approved_by: null,
      approved_at: null,
      deleted_at: null,
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

  if (generateSqlMode) {
    console.log("\n(SQL mode: no confirmation needed)");
  } else {
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
  }

  console.log("\n🗑️  Menghapus data lama...");

  let sqlOutput = "";
  if (generateSqlMode) {
    sqlOutput += "-- Generated by importToSupabase.js --sql mode\n";
    sqlOutput += "-- Run this file in Supabase SQL Editor\n\n";
  }

  const tables = ["transactions", "audit_trail", "master_materials", "warehouses", "sites", "delivery_orders", "app_settings"];
  for (const table of tables) {
    if (generateSqlMode) {
      const pat = deletePatterns[table] || { col: "id", op: "neq", val: "" };
      if (pat.op === "neq") sqlOutput += `DELETE FROM public."${table}" WHERE "${pat.col}" <> '${pat.val}';\n`;
      else sqlOutput += `DELETE FROM public."${table}" WHERE "${pat.col}" = '${pat.val}';\n`;
      console.log(`  ✓ ${table} DELETE generated`);
    } else {
      try {
        await truncateTable(table);
        console.log(`  ✓ ${table} dibersihkan`);
      } catch (e) {
        console.error(`  ✗ Error cleaning ${table}:`, e.message);
      }
    }
  }

  if (generateSqlMode) {
    sqlOutput += "\n";
  }

  console.log("\n📥 Memproses data untuk import...");

  const allTransactions = [...logRows, ...leftoverRows];
  let inserted = 0;
  for (const chunk of chunkArray(allTransactions, 500)) {
    const result = await insertChunk("transactions", "bulk_insert_transactions", chunk);
    if (generateSqlMode) {
      sqlOutput += result.sql + "\n";
      inserted += chunk.length;
    } else if (result.error) {
      console.error("Error inserting transactions (chunk):", result.error);
    } else {
      inserted += result.count;
    }
  }
  console.log(`  ✓ Transactions: ${inserted}/${allTransactions.length} siap`);

  const seedJson = JSON.parse(fs.readFileSync(path.join("src", "data", "seedData.json"), "utf8"));

  let materialsInserted = 0;
  const materials = seedJson.materials || seedJson.master?.materials || [];
  for (const chunk of chunkArray(materials, 500)) {
    const result = await insertChunk("master_materials", "bulk_insert_master_materials", chunk);
    if (generateSqlMode) {
      sqlOutput += result.sql || "";
      materialsInserted += chunk.length;
    } else if (result.error) console.error("Error inserting master_materials (chunk):", result.error);
    else materialsInserted += result.count;
  }
  console.log(`  ✓ Master materials: ${materialsInserted} siap`);

  let whsInserted = 0;
  const warehouses = seedJson.master?.warehouses || [];
  for (const chunk of chunkArray(warehouses, 500)) {
    const result = await insertChunk("warehouses", "bulk_insert_warehouses", chunk);
    if (generateSqlMode) {
      sqlOutput += result.sql || "";
      whsInserted += chunk.length;
    } else if (result.error) console.error("Error inserting warehouses (chunk):", result.error);
    else whsInserted += result.count;
  }
  console.log(`  ✓ Warehouses: ${whsInserted} siap`);

  let sitesInserted = 0;
  const sitesData = sites || seedJson.sites || [];
  for (const chunk of chunkArray(sitesData, 500)) {
    const result = await insertChunk("sites", "bulk_insert_sites", chunk);
    if (generateSqlMode) {
      sqlOutput += result.sql || "";
      sitesInserted += chunk.length;
    } else if (result.error) console.error("Error inserting sites (chunk):", result.error);
    else sitesInserted += result.count;
  }
  console.log(`  ✓ Sites: ${sitesInserted} siap`);

  let doInserted = 0;
  const doData = deliveryOrders.length > 0 ? deliveryOrders : seedJson.deliveryOrders || [];
  for (const chunk of chunkArray(doData, 500)) {
    const result = await insertChunk("delivery_orders", "bulk_insert_delivery_orders", chunk);
    if (generateSqlMode) {
      sqlOutput += result.sql || "";
      doInserted += chunk.length;
    } else if (result.error) console.error("Error inserting delivery_orders (chunk):", result.error);
    else doInserted += result.count;
  }
  console.log(`  ✓ Delivery orders: ${doInserted} siap`);

  if (generateSqlMode) {
    const settingsSql = `INSERT INTO public."app_settings" ("id", "data") VALUES ('master', '${JSON.stringify(seedJson.master).replace(/'/g, "''")}'::jsonb) ON CONFLICT ("id") DO UPDATE SET "data" = EXCLUDED."data";\n`;
    sqlOutput += settingsSql;
    console.log(`  ✓ App settings siap`);
  } else if (useServiceRole) {
    const { error: settingsError } = await supabase.from("app_settings").upsert({
      id: "master",
      data: seedJson.master,
    });
    if (settingsError) console.error("Error inserting app_settings:", settingsError.message);
    else console.log("  ✓ App settings berhasil diimport");
  } else {
    const settingsSql = `INSERT INTO public."app_settings" ("id", "data") VALUES ('master', '${JSON.stringify(seedJson.master).replace(/'/g, "''")}'::jsonb) ON CONFLICT ("id") DO UPDATE SET "data" = EXCLUDED."data";\n`;
    const { error: settingsError } = await supabase.rpc("bulk_insert_app_settings", {
      rows: [{ id: "master", data: seedJson.master }],
    });
    if (settingsError) {
      console.error("  ✗ RPC bulk_insert_app_settings failed:", settingsError.message);
      const sqlFile = "import_app_settings.sql";
      fs.writeFileSync(sqlFile, settingsSql);
      console.log(`  → SQL backup written to ${sqlFile}`);
      console.log(`  → Jalankan SQL ini di Supabase SQL Editor untuk import app_settings`);
    } else {
      console.log("  ✓ App settings berhasil diimport");
    }
  }

  if (generateSqlMode) {
    const sqlFile = "import_data.sql";
    fs.writeFileSync(sqlFile, sqlOutput);
    console.log(`\n✅ SQL file generated: ${sqlFile}`);
    console.log("   Buka Supabase SQL Editor, paste seluruh isi file ini, dan jalankan.");
    console.log("   Ini akan otomatis DELETE semua data lama + INSERT data baru.");
    console.log("   SQL Editor memiliki owner privileges, jadi RLS tidak akan memblokir.");
  } else {
    console.log("\n✅ Import selesai! Data telah siap di Supabase.");
    console.log("   Restart aplikasi dan klik 'Reset DB' untuk refresh data.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
