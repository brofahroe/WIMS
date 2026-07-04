-- Tabel Master Materials
create table public.master_materials (
  "materialName" text primary key,
  "rowId" text,
  "typeMaterial" text,
  "sourceMaterial" text,
  "materialCode" text,
  "unit" text,
  "inbound" numeric default 0,
  "outbound" numeric default 0,
  "transferIn" numeric default 0,
  "transferOut" numeric default 0,
  "borrowIn" numeric default 0,
  "borrowOut" numeric default 0,
  "stockWh" numeric default 0,
  "leftoversStock" numeric default 0,
  "addRemark" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabel Warehouses
create table public.warehouses (
  "whGci" text primary key,
  "whId" text,
  "picWh" text,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabel Sites
create table public.sites (
  "id" serial primary key,
  "no" text,
  "region" text,
  "city" text,
  "siteId" text,
  "siteName" text,
  "address" text,
  "team" text,
  "permit" text,
  "snd" text,
  "donation" text,
  "implementation" text,
  "atp" text,
  "acceptance" text,
  "finalMilestone" text,
  "materialRequest" text,
  "milestoneByZte" text,
  "projectName" text,
  "statusCity" text,
  "materials" jsonb,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabel Delivery Orders (DO)
create table public.delivery_orders (
  "id" serial primary key,
  "siteId" text,
  "siteName" text,
  "subcon" text,
  "region" text,
  "city" text,
  "dropCity" text,
  "doNumber" text,
  "dnNumber" text,
  "materialPickUpdate" text,
  "materialName" text,
  "qty" numeric default 0,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabel Settings (JSON Store)
create table public.app_settings (
  "id" text primary key,
  "data" jsonb not null
);

-- RLS Policies
alter table public.master_materials enable row level security;
alter table public.warehouses enable row level security;
alter table public.sites enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.app_settings enable row level security;

-- Allow all for now (bisa diamankan nanti kalau ada sistem login)
create policy "allow_all_master_materials" on public.master_materials for all using (true) with check (true);
create policy "allow_all_warehouses" on public.warehouses for all using (true) with check (true);
create policy "allow_all_sites" on public.sites for all using (true) with check (true);
create policy "allow_all_delivery_orders" on public.delivery_orders for all using (true) with check (true);
create policy "allow_all_app_settings" on public.app_settings for all using (true) with check (true);
