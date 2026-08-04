-- ==============================================================================
-- WIMS v3 - Import Helper: Security Definer Functions
-- ==============================================================================
-- Run this SQL in Supabase SQL Editor ONCE before running the import script.
-- Creates SECURITY DEFINER functions so the import script can bypass RLS
-- WITHOUT needing the service_role key.

-- Truncate helper
create or replace function public.bulk_truncate(table_name text)
returns void
language plpgsql
security definer
as $$
begin
  if table_name = 'transactions' then
    delete from public.transactions;
  elsif table_name = 'audit_trail' then
    delete from public.audit_trail;
  elsif table_name = 'master_materials' then
    delete from public.master_materials;
  elsif table_name = 'warehouses' then
    delete from public.warehouses;
  elsif table_name = 'sites' then
    delete from public.sites;
  elsif table_name = 'delivery_orders' then
    delete from public.delivery_orders;
  elsif table_name = 'app_settings' then
    delete from public.app_settings;
  end if;
end;
$$;

-- Insert helper for transactions
create or replace function public.bulk_insert_transactions(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.transactions (
    id, source, "rowId", "tagId", "lineId", "taggingType", "transactionType",
    "notaNo", "whGci", "picWarehouse", "date", "time", "sourceDestination",
    "typeMaterial", "materialName", "materialCode", "unit", "qty",
    "siteId", "siteName", "doNumber", "dnNumber", "condition", "picDelivery",
    "vendorSupplier", "idCard", "carPlate", "remarks", "taggingManual",
    "cableLengthMarker", "cableRoll", "inOutQty", "loCriteria", "drumNumber",
    "proofLink", "created_at", "deleted_at", "approval_status", "approved_by", "approved_at"
  )
  select
    (r->>'id')::text, (r->>'source')::text, (r->>'rowId')::text, (r->>'tagId')::text,
    nullif(r->>'lineId','')::text, (r->>'taggingType')::text, (r->>'transactionType')::text,
    (r->>'notaNo')::text, (r->>'whGci')::text, (r->>'picWarehouse')::text,
    (r->>'date')::text, (r->>'time')::text, (r->>'sourceDestination')::text,
    (r->>'typeMaterial')::text, (r->>'materialName')::text, (r->>'materialCode')::text,
    (r->>'unit')::text, (r->>'qty')::numeric, (r->>'siteId')::text, (r->>'siteName')::text,
    (r->>'doNumber')::text, (r->>'dnNumber')::text, (r->>'condition')::text, (r->>'picDelivery')::text,
    (r->>'vendorSupplier')::text, (r->>'idCard')::text, (r->>'carPlate')::text,
    (r->>'remarks')::text, (r->>'taggingManual')::text, (r->>'cableLengthMarker')::text,
    (r->>'cableRoll')::text, (r->>'inOutQty')::text, (r->>'loCriteria')::text,
    (r->>'drumNumber')::text, (r->>'proofLink')::text,
    COALESCE(NULLIF(r->>'created_at','')::timestamptz, NOW()),
    NULLIF(r->>'deleted_at','')::timestamptz,
    COALESCE(NULLIF(r->>'approval_status','')::text, 'APPROVED'),
    NULLIF(r->>'approved_by','')::uuid,
    NULLIF(r->>'approved_at','')::timestamptz
  from jsonb_array_elements(rows) r
  on conflict (id) do nothing;
  
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;

-- Insert helper for master_materials
create or replace function public.bulk_insert_master_materials(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.master_materials (
    "materialName", "rowId", "typeMaterial", "sourceMaterial",
    "materialCode", "unit", "inbound", "outbound", "transferIn", "transferOut",
    "borrowIn", "borrowOut", "stockWh", "leftoversStock", "addRemark", "created_at"
  )
  select
    (r->>'materialName')::text, (r->>'rowId')::text, (r->>'typeMaterial')::text,
    (r->>'sourceMaterial')::text, (r->>'materialCode')::text, (r->>'unit')::text,
    NULLIF(r->>'inbound','')::numeric, NULLIF(r->>'outbound','')::numeric,
    NULLIF(r->>'transferIn','')::numeric, NULLIF(r->>'transferOut','')::numeric,
    NULLIF(r->>'borrowIn','')::numeric, NULLIF(r->>'borrowOut','')::numeric,
    NULLIF(r->>'stockWh','')::numeric, NULLIF(r->>'leftoversStock','')::numeric,
    (r->>'addRemark')::text,
    COALESCE(NULLIF(r->>'created_at','')::timestamptz, NOW())
  from jsonb_array_elements(rows) r
  on conflict ("materialName") do nothing;
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;

-- Insert helper for warehouses
create or replace function public.bulk_insert_warehouses(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.warehouses ("whGci", "whId", "picWh", "created_at")
  select
    (r->>'whGci')::text, (r->>'whId')::text, (r->>'picWh')::text,
    COALESCE(NULLIF(r->>'created_at','')::timestamptz, NOW())
  from jsonb_array_elements(rows) r
  on conflict ("whGci") do nothing;
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;

-- Insert helper for sites
create or replace function public.bulk_insert_sites(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.sites (
    "no", "region", "city", "siteId", "siteName", "address", "team",
    "permit", "snd", "donation", "implementation", "atp", "acceptance",
    "finalMilestone", "materialRequest", "milestoneByZte", "projectName",
    "statusCity", "materials", "created_at"
  )
  select
    (r->>'no')::text, (r->>'region')::text, (r->>'city')::text,
    (r->>'siteId')::text, (r->>'siteName')::text, (r->>'address')::text,
    (r->>'team')::text, (r->>'permit')::text, (r->>'snd')::text,
    (r->>'donation')::text, (r->>'implementation')::text, (r->>'atp')::text,
    (r->>'acceptance')::text, (r->>'finalMilestone')::text, (r->>'materialRequest')::text,
    (r->>'milestoneByZte')::text, (r->>'projectName')::text, (r->>'statusCity')::text,
    (r->>'materials')::jsonb,
    COALESCE(NULLIF(r->>'created_at','')::timestamptz, NOW())
  from jsonb_array_elements(rows) r
  on conflict (id) do nothing;
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;

-- Insert helper for delivery_orders
create or replace function public.bulk_insert_delivery_orders(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.delivery_orders (
    "siteId", "siteName", "subcon", "region", "city", "dropCity",
    "doNumber", "dnNumber", "materialPickUpdate", "materialName", "qty", "created_at"
  )
  select
    (r->>'siteId')::text, (r->>'siteName')::text, (r->>'subcon')::text,
    (r->>'region')::text, (r->>'city')::text, (r->>'dropCity')::text,
    (r->>'doNumber')::text, (r->>'dnNumber')::text, (r->>'materialPickUpdate')::text,
    (r->>'materialName')::text, NULLIF(r->>'qty','')::numeric,
    COALESCE(NULLIF(r->>'created_at','')::timestamptz, NOW())
  from jsonb_array_elements(rows) r
  on conflict (id) do nothing;
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;

-- Insert helper for app_settings
create or replace function public.bulk_insert_app_settings(rows jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  cnt integer;
begin
  insert into public.app_settings ("id", "data")
  select (r->>'id')::text, (r->>'data')::jsonb
  from jsonb_array_elements(rows) r
  on conflict ("id") do nothing;
  get diagnostics cnt := ROW_COUNT;
  return jsonb_build_object('inserted', cnt, 'error', null);
exception
  when others then
    return jsonb_build_object('inserted', 0, 'error', sqlerrm);
end;
$$;
