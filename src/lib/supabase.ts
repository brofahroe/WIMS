import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseKey || 'placeholder-key');

export async function fetchAll(table: string) {
  let allData: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Failed to fetch from ${table}:`, error);
      return [];
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }
  return allData;
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
  return data?.role || null;
}

export async function uploadProofImage(file: File): Promise<string | null> {
  // Buat nama file yang unik untuk menghindari tabrakan
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `receipts/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('proofs')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading image to Supabase:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('proofs')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
