import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadBatch(tableName, data, batchSize = 1000) {
  console.log(`Uploading ${data.length} records to ${tableName}...`);
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).upsert(batch);
    if (error) {
      console.error(`Error uploading batch ${i} - ${i + batch.length} to ${tableName}:`, error);
    }
  }
  console.log(`Finished ${tableName}!`);
}

async function main() {
  const seedPath = path.join(__dirname, '../src/data/seedData.json');
  const rawData = fs.readFileSync(seedPath, 'utf-8');
  const seedData = JSON.parse(rawData);

  // 1. Materials
  await uploadBatch('master_materials', seedData.materials);

  // 2. Warehouses
  // Note: some WH might not have whGci, we should filter those out as it's the PK.
  const validWhs = seedData.master.warehouses.filter(w => w.whGci);
  await uploadBatch('warehouses', validWhs);

  // 3. Sites
  // Add an auto-incrementing mock ID or just let Supabase generate IDs for `sites` and `delivery_orders`?
  // Since we defined `id serial primary key`, we can just OMIT the `id` field when inserting.
  // Wait, if we use upsert without PK it might complain. We will use .insert() for sites and DOs.
  console.log(`Uploading ${seedData.sites.length} sites...`);
  const { error: errorSites } = await supabase.from('sites').insert(seedData.sites);
  if (errorSites) console.error("Error uploading sites:", errorSites);
  else console.log("Finished sites!");

  // 4. Delivery Orders
  console.log(`Uploading ${seedData.deliveryOrders.length} delivery_orders...`);
  for (let i = 0; i < seedData.deliveryOrders.length; i += 1000) {
    const batch = seedData.deliveryOrders.slice(i, i + 1000);
    const { error: errorDo } = await supabase.from('delivery_orders').insert(batch);
    if (errorDo) console.error("Error uploading DOs:", errorDo);
  }
  console.log("Finished delivery_orders!");

  // 5. App Settings (The rest of Master Data)
  const settingsData = {
    transactionTypes: seedData.master.transactionTypes,
    taggingTypes: seedData.master.taggingTypes,
    units: seedData.master.units,
    sources: seedData.master.sources,
    typeMaterials: seedData.master.typeMaterials,
    conditions: seedData.master.conditions,
    labelPrefixes: seedData.master.labelPrefixes,
    cableRolls: seedData.master.cableRolls,
    materialMilestones: seedData.master.materialMilestones
  };

  const { error: errorSettings } = await supabase.from('app_settings').upsert({
    id: 'master',
    data: settingsData
  });
  
  if (errorSettings) console.error("Error uploading app_settings:", errorSettings);
  else console.log("Finished app_settings!");

  console.log('ALL DONE!');
}

main().catch(console.error);
