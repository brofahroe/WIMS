import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Baca konfigurasi dari .env
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const seedPath = path.join(__dirname, '../src/data/seedData.json');
  const rawData = fs.readFileSync(seedPath, 'utf-8');
  const seedData = JSON.parse(rawData);

  const transactions = [...seedData.logRows, ...seedData.leftoverRows];
  
  console.log(`Found ${transactions.length} transactions. Uploading in batches...`);
  
  const batchSize = 1000;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    const { error } = await supabase.from('transactions').upsert(batch);
    if (error) {
      console.error(`Error uploading batch ${i} - ${i + batch.length}:`, error);
    } else {
      console.log(`Successfully uploaded batch ${i} - ${i + batch.length}`);
    }
  }

  console.log('Finished uploading seed data to Supabase!');
}

main().catch(console.error);
