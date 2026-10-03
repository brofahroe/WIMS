import crypto from "node:crypto";
import path from "node:path";
import xlsx from "xlsx";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function normalize(value) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function asText(value) {
  return value === null || value === undefined || value === "" ? null : String(value).trim();
}

function asDate(value) {
  if (typeof value === "number") {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}

function fingerprint(row) {
  return [
    normalize(row.source),
    normalize(row.taggingType),
    row.whGci,
    asDate(row.date) ?? String(row.date ?? ""),
    normalize(row.transactionType),
    normalize(row.notaNo),
    normalize(row.materialName),
    Number(row.qty) || 0,
    normalize(row.lineId),
    normalize(row.drumNumber),
    normalize(row.siteId),
  ].join("|").toLowerCase();
}

function mapRows(sheet, source, warehouseGci, cutoff) {
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  const records = [];
  const issues = [];

  for (const [index, row] of data.slice(4).entries()) {
    const isLeftover = source === "leftovers";
    const transactionType = row[isLeftover ? 3 : 2];
    if (!row || row.length === 0 || !transactionType) continue;

    const rowWarehouse = asText(row[isLeftover ? 5 : 4]);
    if (normalize(rowWarehouse) !== normalize(warehouseGci)) continue;

    const transactionDate = asDate(row[isLeftover ? 7 : 6]);
    if (!transactionDate) {
      issues.push({ source, row: index + 5, issue: "Tanggal tidak dapat dibaca" });
      continue;
    }
    if (transactionDate > cutoff) continue;

    const record = isLeftover
      ? {
          id: crypto.randomUUID(),
          source: "leftovers",
          rowId: asText(row[0]),
          tagId: asText(row[1]),
          lineId: Number(row[2]) || null,
          taggingType: "LEFTOVERS",
          transactionType: asText(transactionType),
          notaNo: asText(row[4]),
          whGci: rowWarehouse,
          picWarehouse: asText(row[6]),
          date: transactionDate,
          time: asText(row[8]),
          sourceDestination: asText(row[9]),
          typeMaterial: asText(row[10]),
          materialName: asText(row[11]),
          materialCode: asText(row[12]),
          unit: asText(row[13]),
          qty: Number(row[14]) || 0,
          siteId: asText(row[15]),
          siteName: asText(row[16]),
          doNumber: asText(row[17]),
          dnNumber: asText(row[18]),
          condition: asText(row[19]),
          picDelivery: asText(row[20]),
          vendorSupplier: asText(row[21]),
          idCard: asText(row[22]),
          carPlate: asText(row[23]),
          remarks: asText(row[24]),
          drumNumber: asText(row[25]),
          cableLengthMarker: asText(row[26]),
          inOutQty: asText(row[27]),
          loCriteria: asText(row[28]),
          taggingManual: asText(row[29]),
          approvalStatus: "APPROVED",
        }
      : {
          id: crypto.randomUUID(),
          source: "logfile",
          rowId: asText(row[0]),
          lineId: Number(row[1]) || null,
          taggingType: "LOGFILE",
          transactionType: asText(transactionType),
          notaNo: asText(row[3]),
          whGci: rowWarehouse,
          picWarehouse: asText(row[5]),
          date: transactionDate,
          time: asText(row[7]),
          sourceDestination: asText(row[8]),
          typeMaterial: asText(row[9]),
          materialName: asText(row[10]),
          materialCode: asText(row[11]),
          unit: asText(row[12]),
          qty: Number(row[13]) || 0,
          siteId: asText(row[14]),
          siteName: asText(row[15]),
          doNumber: asText(row[16]),
          dnNumber: asText(row[17]),
          condition: asText(row[18]),
          picDelivery: asText(row[19]),
          vendorSupplier: asText(row[20]),
          idCard: asText(row[21]),
          carPlate: asText(row[22]),
          remarks: asText(row[23]),
          drumNumber: asText(row[24]),
          approvalStatus: "APPROVED",
        };
    records.push(record);
  }

  return { records, issues };
}

async function fetchExisting(supabase, warehouseGci, cutoff) {
  const rows = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("transactions")
      .select('"id", "source", "whGci", "date", "transactionType", "notaNo", "materialName", "qty", "lineId", "drumNumber", "siteId"')
      .eq("whGci", warehouseGci)
      .lte("date", cutoff)
      .range(start, start + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function insertInChunks(supabase, records) {
  for (let start = 0; start < records.length; start += 500) {
    const { error } = await supabase.from("transactions").insert(records.slice(start, start + 500));
    if (error) throw error;
  }
}

async function main() {
  const file = readOption("--file");
  const warehouseGci = readOption("--warehouse");
  const cutoff = readOption("--cutoff");
  const apply = process.argv.includes("--apply");

  if (!file || !warehouseGci || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
    throw new Error("Gunakan: node scripts/importWarehouseHistory.js --file <workbook.xlsm> --warehouse <WH GCI> --cutoff YYYY-MM-DD [--apply]");
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia untuk preview maupun import historis.");
  }

  const workbookPath = path.resolve(file);
  const workbook = xlsx.readFile(workbookPath);
  if (!workbook.Sheets.Logfile || !workbook.Sheets.LO_Logfile) {
    throw new Error("Workbook harus memiliki sheet Logfile dan LO_Logfile.");
  }

  const mapped = [
    mapRows(workbook.Sheets.Logfile, "logfile", warehouseGci, cutoff),
    mapRows(workbook.Sheets.LO_Logfile, "leftovers", warehouseGci, cutoff),
  ];
  const imported = mapped.flatMap((result) => result.records);
  const issues = mapped.flatMap((result) => result.issues);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [warehouseResult, existingRows] = await Promise.all([
    supabase.from("warehouses").select('"whGci"').eq("whGci", warehouseGci).single(),
    fetchExisting(supabase, warehouseGci, cutoff),
  ]);
  if (warehouseResult.error || !warehouseResult.data) throw new Error(`Gudang '${warehouseGci}' belum terdaftar di master gudang.`);

  const knownFingerprints = new Set(existingRows.map(fingerprint));
  const candidates = [];
  const duplicates = [];
  for (const record of imported) {
    const key = fingerprint(record);
    if (knownFingerprints.has(key)) {
      duplicates.push(record);
      continue;
    }
    knownFingerprints.add(key);
    candidates.push(record);
  }

  console.log(JSON.stringify({
    mode: apply ? "APPLY" : "DRY RUN",
    warehouseGci,
    cutoff,
    sourceRows: imported.length,
    existingRows: existingRows.length,
    exactDuplicatesSkipped: duplicates.length,
    invalidRows: issues.length,
    rowsToInsert: candidates.length,
    sampleDuplicates: duplicates.slice(0, 5).map(({ rowId, notaNo, materialName, date, qty }) => ({ rowId, notaNo, materialName, date, qty })),
    sampleIssues: issues.slice(0, 10),
  }, null, 2));

  if (issues.length > 0) {
    throw new Error("Ada baris dengan tanggal tidak terbaca. Tidak ada data yang diimpor; perbaiki sumber lalu jalankan ulang preview.");
  }
  if (!apply) {
    console.log("Preview saja. Tambahkan --apply setelah meninjau hasil di atas untuk menulis data.");
    return;
  }
  if (candidates.length > 0) await insertInChunks(supabase, candidates);
  console.log(`Import selesai: ${candidates.length} baris ditambahkan ke ${warehouseGci}. Gudang tetap ditandai dengan status riwayat yang ada sampai rekonsiliasi disahkan.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});