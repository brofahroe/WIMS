-- ==============================================================================
-- WIMS v3 - Phase 1: Security Hardening & Data Integrity
-- ==============================================================================
-- Run this migration in Supabase SQL Editor after applying the base schema.

-- 1. Soft-delete support for transactions
alter table public.transactions add column if not exists "deleted_at" timestamp with time zone;

-- 2. Structured audit trail
create table if not exists public.audit_trail (
  "id" text primary key default gen_random_uuid()::text,
  "action" text not null,
  "table_name" text not null,
  "record_id" text,
  "old_values" jsonb,
  "new_values" jsonb,
  "performed_by" uuid references auth.users(id) on delete set null,
  "performed_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists "idx_audit_trail_action" on public.audit_trail("action");
create index if not exists "idx_audit_trail_table" on public.audit_trail("table_name");
create index if not exists "idx_audit_trail_performed_at" on public.audit_trail("performed_at");
create index if not exists "idx_audit_trail_user" on public.audit_trail("performed_by");

alter table public.audit_trail enable row level security;

create policy "Enable read access for all users" on public.audit_trail
  for select using (true);

create policy "Enable insert for all users" on public.audit_trail
  for insert with check (true);

create policy "Enable update for all users" on public.audit_trail
  for update using (true);

create policy "Enable delete for all users" on public.audit_trail
  for delete using (true);

-- 3. Drop permissive policies on master_materials
drop policy if exists "allow_all_master_materials" on public.master_materials;
drop policy if exists "allow_all_warehouses" on public.warehouses;
drop policy if exists "allow_all_sites" on public.sites;
drop policy if exists "allow_all_delivery_orders" on public.delivery_orders;
drop policy if exists "allow_all_app_settings" on public.app_settings;

-- Admin full access
create policy "admin_all_master_materials" on public.master_materials
  for all using (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'))
  with check (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'));

create policy "admin_all_warehouses" on public.warehouses
  for all using (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'))
  with check (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'));

create policy "admin_all_sites" on public.sites
  for all using (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'))
  with check (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'));

create policy "admin_all_delivery_orders" on public.delivery_orders
  for all using (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'))
  with check (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'));

create policy "admin_all_app_settings" on public.app_settings
  for all using (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'))
  with check (exists (select 1 from public.user_roles where id = auth.uid() and role = 'Admin'));

-- Manager / Staff read access
create policy "read_master_materials" on public.master_materials
  for select using (true);

create policy "read_warehouses" on public.warehouses
  for select using (true);

create policy "read_sites" on public.sites
  for select using (true);

create policy "read_delivery_orders" on public.delivery_orders
  for select using (true);

create policy "read_app_settings" on public.app_settings
  for select using (true);

-- Transactions: Admin/Staff insert+update, Manager read, all can read non-deleted
drop policy if exists "Enable read access for all users" on public.transactions;
drop policy if exists "Enable insert for all users" on public.transactions;
drop policy if exists "Enable update for all users" on public.transactions;
drop policy if exists "Enable delete for all users" on public.transactions;

create policy "transactions_read_all" on public.transactions
  for select using ("deleted_at" is null);

create policy "transactions_insert_staff" on public.transactions
  for insert with check (
    exists (
      select 1 from public.user_roles
      where id = auth.uid() and role in ('Admin', 'Staff Gudang')
    )
  );

create policy "transactions_update_staff" on public.transactions
  for update using (
    "deleted_at" is null and
    exists (
      select 1 from public.user_roles
      where id = auth.uid() and role in ('Admin', 'Staff Gudang')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where id = auth.uid() and role in ('Admin', 'Staff Gudang')
    )
  );

create policy "transactions_delete_admin" on public.transactions
  for delete using (
    exists (
      select 1 from public.user_roles
      where id = auth.uid() and role = 'Admin'
    )
  );
