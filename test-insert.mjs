import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wcfozkscdnxvdwhmrbax.supabase.co';
const supabaseKey = 'sb_publishable_dQlfA6kWnsk_Uea3lXT3Qw_oaj_3zr8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const row = {
    id: `test-${Date.now()}`,
    source: "logfile",
    rowId: "123",
    lineId: 1, // sending as number to see if it complains
    taggingType: "LOGFILE",
    transactionType: "TRANSFER OUT",
    notaNo: "TRX-W001-2607-001",
    whGci: "EJ Malang 01",
    date: "2026-07-07",
    time: "22:53",
    sourceDestination: "TRANSFER",
    materialName: "Helical Dead End",
    qty: 88,
    siteId: "test",
    siteName: "test",
    picDelivery: "Oka",
    remarks: "",
  };

  const { data, error } = await supabase.from('transactions').insert([row]);
  
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("INSERT SUCCESS!");
  }
}

testInsert();
