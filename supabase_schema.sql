-- Hapus tabel lama (karena kita akan memperbaikinya)
drop table if exists public.transactions;

-- Buat ulang tabel transaksi dengan menggunakan tanda kutip ("") 
-- agar huruf besar/kecil (camelCase) persis sama dengan kode aplikasi
create table public.transactions (
  "id" text primary key,
  "source" text not null,
  "rowId" text,
  "tagId" text,
  "lineId" text,
  "taggingType" text not null,
  "transactionType" text,
  "notaNo" text,
  "whGci" text,
  "picWarehouse" text,
  "date" text,
  "time" text,
  "sourceDestination" text,
  "typeMaterial" text,
  "materialName" text,
  "materialCode" text,
  "unit" text,
  "qty" numeric not null default 0,
  "siteId" text,
  "siteName" text,
  "doNumber" text,
  "dnNumber" text,
  "condition" text,
  "picDelivery" text,
  "vendorSupplier" text,
  "idCard" text,
  "carPlate" text,
  "remarks" text,
  "taggingManual" text,
  "cableLengthMarker" text,
  "cableRoll" text,
  "inOutQty" text,
  "loCriteria" text,
  "drumNumber" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

create index "idx_transactions_source" on public.transactions("source");
create index "idx_transactions_date" on public.transactions("date");
create index "idx_transactions_material" on public.transactions("materialName");

alter table public.transactions enable row level security;

create policy "Enable read access for all users" on public.transactions
  for select using (true);

create policy "Enable insert for all users" on public.transactions
  for insert with check (true);

create policy "Enable update for all users" on public.transactions
  for update using (true);

create policy "Enable delete for all users" on public.transactions
  for delete using (true);
