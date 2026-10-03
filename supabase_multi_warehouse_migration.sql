-- Multi-warehouse access and readiness foundation.
-- Apply after supabase_phase1_migration.sql.

alter table public.warehouses
  add column if not exists "operationalStatus" text not null default 'SETUP'
    check ("operationalStatus" in ('SETUP', 'OPERATIONAL')),
  add column if not exists "historyComplete" boolean not null default false,
  add column if not exists "proposedOperationalStatus" text
    check ("proposedOperationalStatus" in ('SETUP', 'OPERATIONAL')),
  add column if not exists "proposedHistoryComplete" boolean,
  add column if not exists "statusProposedBy" uuid references auth.users(id) on delete set null,
  add column if not exists "statusProposedAt" timestamp with time zone,
  add column if not exists "stockEffectiveDate" date,
  add column if not exists "openingStockVerifiedAt" timestamp with time zone,
  add column if not exists "openingStockVerifiedBy" uuid references auth.users(id) on delete set null;

-- Malang is the established live warehouse; newly added branches remain in setup
-- until their physical opening stock has been verified.
update public.warehouses
set "operationalStatus" = 'OPERATIONAL', "historyComplete" = true
where "whGci" = 'EJ-Malang-01';

create table if not exists public.user_warehouse_assignments (
  user_id uuid not null references public.user_roles(id) on delete cascade,
  warehouse_gci text not null references public.warehouses("whGci") on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (user_id, warehouse_gci)
);

alter table public.user_warehouse_assignments enable row level security;

create or replace function public.current_wims_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where id = auth.uid()
$$;

create or replace function public.can_access_warehouse(warehouse_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_wims_role() in ('Admin', 'Manager'), false)
    or exists (
      select 1
      from public.user_warehouse_assignments assignment
      where assignment.user_id = auth.uid()
        and assignment.warehouse_gci = warehouse_code
    )
$$;

create or replace function public.can_transact_in_warehouse(warehouse_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.warehouses warehouse
    where warehouse."whGci" = warehouse_code
      and warehouse."operationalStatus" = 'OPERATIONAL'
  )
$$;

grant execute on function public.current_wims_role() to authenticated;
grant execute on function public.can_access_warehouse(text) to authenticated;
grant execute on function public.can_transact_in_warehouse(text) to authenticated;

-- Preserve existing staff access to the established Malang warehouse.
insert into public.user_warehouse_assignments (user_id, warehouse_gci)
select role.id, 'EJ-Malang-01'
from public.user_roles role
where role.role = 'Staff Gudang'
  and exists (select 1 from public.warehouses where "whGci" = 'EJ-Malang-01')
on conflict (user_id, warehouse_gci) do nothing;

drop policy if exists "admin_all_warehouses" on public.warehouses;
drop policy if exists "read_warehouses" on public.warehouses;
drop policy if exists "allow_all_warehouses" on public.warehouses;
create policy "authenticated_read_warehouses" on public.warehouses
  for select using (auth.uid() is not null);
create policy "admin_manage_warehouses" on public.warehouses
  for all using (public.current_wims_role() = 'Admin')
  with check (public.current_wims_role() = 'Admin');

drop policy if exists "user_assignments_read" on public.user_warehouse_assignments;
drop policy if exists "user_assignments_manage" on public.user_warehouse_assignments;
create policy "user_assignments_read" on public.user_warehouse_assignments
  for select using (
    user_id = auth.uid()
    or public.current_wims_role() in ('Admin', 'Manager')
  );
create policy "user_assignments_manage" on public.user_warehouse_assignments
  for all using (public.current_wims_role() in ('Admin', 'Manager'))
  with check (public.current_wims_role() in ('Admin', 'Manager'));

drop policy if exists "transactions_read_all" on public.transactions;
drop policy if exists "transactions_insert_staff" on public.transactions;
drop policy if exists "transactions_update_staff" on public.transactions;
drop policy if exists "transactions_delete_admin" on public.transactions;
drop policy if exists "Enable read access for all users" on public.transactions;
drop policy if exists "Enable insert for all users" on public.transactions;
drop policy if exists "Enable update for all users" on public.transactions;
drop policy if exists "Enable delete for all users" on public.transactions;

create policy "transactions_read_by_warehouse" on public.transactions
  for select using (
    "deleted_at" is null
    and (
      public.current_wims_role() in ('Admin', 'Manager')
      or (
        public.current_wims_role() = 'Staff Gudang'
        and public.can_access_warehouse("whGci")
      )
    )
  );

create policy "transactions_insert_by_warehouse" on public.transactions
  for insert with check (
    public.current_wims_role() in ('Admin', 'Staff Gudang')
    and public.can_access_warehouse("whGci")
    and public.can_transact_in_warehouse("whGci")
  );

create policy "transactions_update_by_warehouse" on public.transactions
  for update using (
    "deleted_at" is null
    and public.current_wims_role() in ('Admin', 'Staff Gudang')
    and public.can_access_warehouse("whGci")
  )
  with check (
    public.current_wims_role() in ('Admin', 'Staff Gudang')
    and public.can_access_warehouse("whGci")
  );

create policy "transactions_delete_admin" on public.transactions
  for delete using (public.current_wims_role() = 'Admin');

alter table public.transactions
  add column if not exists "warehouseTransferId" text,
  add column if not exists "destinationWarehouseGci" text;

create table if not exists public.warehouse_opening_balances (
  "id" text primary key,
  "warehouseGci" text not null references public.warehouses("whGci"),
  "materialName" text not null references public.master_materials("materialName"),
  "qty" numeric not null check ("qty" >= 0),
  "taggingType" text not null check ("taggingType" in ('LOGFILE', 'LEFTOVERS')),
  "drumNumber" text,
  "effectiveDate" date not null,
  "status" text not null default 'PENDING' check ("status" in ('PENDING', 'VERIFIED')),
  "verifiedBy" uuid references auth.users(id) on delete set null,
  "verifiedAt" timestamp with time zone,
  "createdBy" uuid references auth.users(id) on delete set null,
  "createdAt" timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists "idx_opening_balances_warehouse_material"
  on public.warehouse_opening_balances("warehouseGci", "materialName", "effectiveDate");

alter table public.warehouse_opening_balances enable row level security;
create policy "opening_balances_read_scope" on public.warehouse_opening_balances
  for select using (
    public.current_wims_role() in ('Admin', 'Manager')
    or public.can_access_warehouse("warehouseGci")
  );
create policy "opening_balances_insert_pending" on public.warehouse_opening_balances
  for insert with check (
    "status" = 'PENDING'
    and public.current_wims_role() in ('Admin', 'Staff Gudang')
    and public.can_access_warehouse("warehouseGci")
  );
create policy "opening_balances_verify" on public.warehouse_opening_balances
  for update using (public.current_wims_role() in ('Admin', 'Manager'))
  with check (
    public.current_wims_role() in ('Admin', 'Manager')
    and ("status" <> 'VERIFIED' or ("verifiedBy" = auth.uid() and "verifiedAt" is not null))
  );
create policy "opening_balances_delete_admin" on public.warehouse_opening_balances
  for delete using (public.current_wims_role() = 'Admin');

create table if not exists public.warehouse_transfers (
  "id" text primary key,
  "notaNo" text not null unique,
  "sourceWarehouseGci" text not null references public.warehouses("whGci"),
  "destinationWarehouseGci" text not null references public.warehouses("whGci"),
  "status" text not null default 'IN_TRANSIT'
    check ("status" in ('IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'RESOLVED')),
  "createdBy" uuid references auth.users(id) on delete set null,
  "createdAt" timestamp with time zone not null default timezone('utc'::text, now()),
  "receivedBy" uuid references auth.users(id) on delete set null,
  "receivedAt" timestamp with time zone,
  "resolvedBy" uuid references auth.users(id) on delete set null,
  "resolvedAt" timestamp with time zone,
  "resolutionReason" text
);

create table if not exists public.warehouse_transfer_lines (
  "id" text primary key,
  "transferId" text not null references public.warehouse_transfers("id") on delete cascade,
  "sourceWarehouseGci" text not null references public.warehouses("whGci"),
  "destinationWarehouseGci" text not null references public.warehouses("whGci"),
  "materialName" text not null references public.master_materials("materialName"),
  "qtySent" numeric not null check ("qtySent" > 0),
  "qtyReceived" numeric not null default 0 check ("qtyReceived" >= 0),
  "qtyReturned" numeric not null default 0 check ("qtyReturned" >= 0),
  "qtyWrittenOff" numeric not null default 0 check ("qtyWrittenOff" >= 0),
  "drumNumber" text,
  "unit" text,
  check ("qtyReceived" + "qtyReturned" + "qtyWrittenOff" <= "qtySent")
);

create index if not exists "idx_transfer_lines_transfer" on public.warehouse_transfer_lines("transferId");
create index if not exists "idx_transfer_lines_destination" on public.warehouse_transfer_lines("destinationWarehouseGci");

create table if not exists public.warehouse_transfer_receipts (
  "id" text primary key,
  "transferLineId" text not null references public.warehouse_transfer_lines("id"),
  "qtyReceived" numeric not null check ("qtyReceived" > 0),
  "receivedBy" uuid references auth.users(id) on delete set null,
  "receivedAt" timestamp with time zone not null default timezone('utc'::text, now()),
  "remarks" text
);

alter table public.warehouse_transfers enable row level security;
alter table public.warehouse_transfer_lines enable row level security;
alter table public.warehouse_transfer_receipts enable row level security;

create policy "warehouse_transfers_read_scope" on public.warehouse_transfers
  for select using (
    public.current_wims_role() in ('Admin', 'Manager')
    or public.can_access_warehouse("sourceWarehouseGci")
    or public.can_access_warehouse("destinationWarehouseGci")
  );
create policy "warehouse_transfer_lines_read_scope" on public.warehouse_transfer_lines
  for select using (
    public.current_wims_role() in ('Admin', 'Manager')
    or public.can_access_warehouse("sourceWarehouseGci")
    or public.can_access_warehouse("destinationWarehouseGci")
  );
create policy "warehouse_transfer_receipts_read_scope" on public.warehouse_transfer_receipts
  for select using (
    public.current_wims_role() in ('Admin', 'Manager')
    or exists (
      select 1
      from public.warehouse_transfer_lines line
      where line."id" = "transferLineId"
        and public.can_access_warehouse(line."destinationWarehouseGci")
    )
  );

create or replace function public.dispatch_warehouse_transfer(
  p_transfer_id text,
  p_line_id text,
  p_nota_no text,
  p_source_warehouse text,
  p_destination_warehouse text,
  p_material_name text,
  p_qty numeric,
  p_unit text,
  p_drum_number text,
  p_date text,
  p_remarks text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  material_code text;
  source_pic text;
  stock_effective_date date;
  opening_stock numeric;
  ledger_stock numeric;
begin
  if auth.uid() is null
    or public.current_wims_role() not in ('Admin', 'Staff Gudang')
    or not public.can_access_warehouse(p_source_warehouse)
    or not public.can_transact_in_warehouse(p_source_warehouse)
    or not public.can_transact_in_warehouse(p_destination_warehouse)
    or p_source_warehouse = p_destination_warehouse
    or p_qty <= 0 then
    raise exception 'Transfer tidak diizinkan atau datanya tidak valid';
  end if;

  select "materialCode" into material_code
  from public.master_materials
  where "materialName" = p_material_name;
  if not found then raise exception 'Material tidak ditemukan'; end if;

  perform 1 from public.warehouses where "whGci" = p_source_warehouse for update;

  select max("effectiveDate") into stock_effective_date
  from public.warehouse_opening_balances
  where "warehouseGci" = p_source_warehouse
    and "materialName" = p_material_name
    and "taggingType" = 'LOGFILE'
    and "status" = 'VERIFIED';

  select coalesce(sum("qty"), 0) into opening_stock
  from public.warehouse_opening_balances
  where "warehouseGci" = p_source_warehouse
    and "materialName" = p_material_name
    and "taggingType" = 'LOGFILE'
    and "status" = 'VERIFIED'
    and "effectiveDate" = stock_effective_date;

  select coalesce(sum(case
    when upper("transactionType") in ('INBOUND', 'TRANSFER IN', 'BORROW IN') then "qty"
    when upper("transactionType") in ('OUTBOUND', 'TRANSFER OUT', 'BORROW OUT') then -"qty"
    else 0
  end), 0) into ledger_stock
  from public.transactions
  where "whGci" = p_source_warehouse
    and "materialName" = p_material_name
    and "source" = 'logfile'
    and "deleted_at" is null
    and (stock_effective_date is null or left(coalesce("date", ''), 10) > stock_effective_date::text);

  if opening_stock + ledger_stock < p_qty then
    raise exception 'Stok gudang asal tidak mencukupi. Tersedia: %, diminta: %', opening_stock + ledger_stock, p_qty;
  end if;

  select "picWh" into source_pic
  from public.warehouses
  where "whGci" = p_source_warehouse;

  insert into public.warehouse_transfers (
    "id", "notaNo", "sourceWarehouseGci", "destinationWarehouseGci", "createdBy"
  ) values (
    p_transfer_id, p_nota_no, p_source_warehouse, p_destination_warehouse, auth.uid()
  );

  insert into public.warehouse_transfer_lines (
    "id", "transferId", "sourceWarehouseGci", "destinationWarehouseGci",
    "materialName", "qtySent", "drumNumber", "unit"
  ) values (
    p_line_id, p_transfer_id, p_source_warehouse, p_destination_warehouse,
    p_material_name, p_qty, nullif(p_drum_number, ''), p_unit
  );

  insert into public.transactions (
    "id", "source", "rowId", "lineId", "taggingType", "transactionType", "notaNo",
    "whGci", "picWarehouse", "date", "sourceDestination", "materialName", "materialCode",
    "unit", "qty", "remarks", "drumNumber", "warehouseTransferId", "destinationWarehouseGci"
  ) values (
    gen_random_uuid()::text, 'logfile', p_line_id, 1, 'LOGFILE', 'TRANSFER OUT', p_nota_no,
    p_source_warehouse, source_pic, p_date, p_destination_warehouse, p_material_name, material_code,
    p_unit, p_qty, p_remarks, nullif(p_drum_number, ''), p_transfer_id, p_destination_warehouse
  );

  return jsonb_build_object('transferId', p_transfer_id, 'status', 'IN_TRANSIT');
end;
$$;

create or replace function public.receive_warehouse_transfer(
  p_transfer_line_id text,
  p_qty_received numeric,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_line public.warehouse_transfer_lines%rowtype;
  transfer_status text;
  target_pic text;
begin
  select line.* into transfer_line
  from public.warehouse_transfer_lines line
  join public.warehouse_transfers transfer on transfer."id" = line."transferId"
  where line."id" = p_transfer_line_id
  for update of line;

  if not found then raise exception 'Detail transfer tidak ditemukan'; end if;
  if auth.uid() is null
    or p_qty_received <= 0
    or not (
      public.current_wims_role() = 'Admin'
      or (public.current_wims_role() = 'Staff Gudang' and public.can_access_warehouse(transfer_line."destinationWarehouseGci"))
    ) then
    raise exception 'Penerimaan transfer tidak diizinkan atau jumlah tidak valid';
  end if;
  if transfer_line."qtyReceived" + transfer_line."qtyReturned" + transfer_line."qtyWrittenOff" + p_qty_received > transfer_line."qtySent" then
    raise exception 'Jumlah diterima melebihi sisa transfer';
  end if;

  select "picWh" into target_pic
  from public.warehouses
  where "whGci" = transfer_line."destinationWarehouseGci";

  update public.warehouse_transfer_lines
  set "qtyReceived" = "qtyReceived" + p_qty_received
  where "id" = p_transfer_line_id;

  insert into public.warehouse_transfer_receipts (
    "id", "transferLineId", "qtyReceived", "receivedBy", "remarks"
  ) values (
    gen_random_uuid()::text, p_transfer_line_id, p_qty_received, auth.uid(), p_remarks
  );

  insert into public.transactions (
    "id", "source", "rowId", "lineId", "taggingType", "transactionType", "notaNo",
    "whGci", "picWarehouse", "date", "sourceDestination", "materialName", "materialCode",
    "unit", "qty", "remarks", "drumNumber", "warehouseTransferId", "destinationWarehouseGci"
  ) values (
    gen_random_uuid()::text, 'logfile', p_transfer_line_id, 1, 'LOGFILE', 'TRANSFER IN',
    (select "notaNo" from public.warehouse_transfers where "id" = transfer_line."transferId"),
    transfer_line."destinationWarehouseGci", target_pic, current_date::text,
    transfer_line."sourceWarehouseGci", transfer_line."materialName",
    (select "materialCode" from public.master_materials where "materialName" = transfer_line."materialName"),
    transfer_line."unit", p_qty_received, p_remarks, transfer_line."drumNumber",
    transfer_line."transferId", transfer_line."sourceWarehouseGci"
  );

  select case
    when bool_and("qtyReceived" + "qtyReturned" + "qtyWrittenOff" = "qtySent") then 'RECEIVED'
    when bool_or("qtyReceived" > 0) then 'PARTIALLY_RECEIVED'
    else 'IN_TRANSIT'
  end into transfer_status
  from public.warehouse_transfer_lines
  where "transferId" = transfer_line."transferId";

  update public.warehouse_transfers
  set "status" = transfer_status, "receivedBy" = auth.uid(), "receivedAt" = now()
  where "id" = transfer_line."transferId";

  return jsonb_build_object('transferId', transfer_line."transferId", 'status', transfer_status);
end;
$$;

create or replace function public.resolve_warehouse_transfer_line(
  p_transfer_line_id text,
  p_qty_returned numeric,
  p_qty_written_off numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_line public.warehouse_transfer_lines%rowtype;
  outstanding numeric;
  transfer_status text;
  source_pic text;
begin
  select line.* into transfer_line
  from public.warehouse_transfer_lines line
  where line."id" = p_transfer_line_id
  for update;

  if not found then raise exception 'Detail transfer tidak ditemukan'; end if;
  if auth.uid() is null
    or p_qty_returned < 0
    or p_qty_written_off < 0
    or length(trim(coalesce(p_reason, ''))) = 0
    or not (
      public.current_wims_role() = 'Admin'
      or (public.current_wims_role() = 'Staff Gudang' and public.can_access_warehouse(transfer_line."sourceWarehouseGci"))
    ) then
    raise exception 'Penyelesaian transfer tidak diizinkan atau datanya tidak valid';
  end if;

  outstanding := transfer_line."qtySent" - transfer_line."qtyReceived" - transfer_line."qtyReturned" - transfer_line."qtyWrittenOff";
  if p_qty_returned + p_qty_written_off <> outstanding then
    raise exception 'Jumlah kembali dan penyesuaian harus sama dengan sisa transfer';
  end if;

  update public.warehouse_transfer_lines
  set "qtyReturned" = "qtyReturned" + p_qty_returned,
      "qtyWrittenOff" = "qtyWrittenOff" + p_qty_written_off
  where "id" = p_transfer_line_id;

  if p_qty_returned > 0 then
    select "picWh" into source_pic
    from public.warehouses
    where "whGci" = transfer_line."sourceWarehouseGci";

    insert into public.transactions (
      "id", "source", "rowId", "lineId", "taggingType", "transactionType", "notaNo",
      "whGci", "picWarehouse", "date", "sourceDestination", "materialName", "materialCode",
      "unit", "qty", "remarks", "drumNumber", "warehouseTransferId", "destinationWarehouseGci"
    ) values (
      gen_random_uuid()::text, 'logfile', p_transfer_line_id, 1, 'LOGFILE', 'TRANSFER IN',
      (select "notaNo" from public.warehouse_transfers where "id" = transfer_line."transferId"),
      transfer_line."sourceWarehouseGci", source_pic, current_date::text,
      transfer_line."destinationWarehouseGci", transfer_line."materialName",
      (select "materialCode" from public.master_materials where "materialName" = transfer_line."materialName"),
      transfer_line."unit", p_qty_returned, p_reason, transfer_line."drumNumber",
      transfer_line."transferId", transfer_line."destinationWarehouseGci"
    );
  end if;

  select case
    when bool_and("qtyReceived" + "qtyReturned" + "qtyWrittenOff" = "qtySent") then 'RESOLVED'
    when bool_or("qtyReceived" > 0) then 'PARTIALLY_RECEIVED'
    else 'IN_TRANSIT'
  end into transfer_status
  from public.warehouse_transfer_lines
  where "transferId" = transfer_line."transferId";

  update public.warehouse_transfers
  set "status" = transfer_status,
      "resolvedBy" = auth.uid(),
      "resolvedAt" = now(),
      "resolutionReason" = p_reason
  where "id" = transfer_line."transferId";

  return jsonb_build_object('transferId', transfer_line."transferId", 'status', transfer_status);
end;
$$;

revoke all on function public.dispatch_warehouse_transfer(text, text, text, text, text, text, numeric, text, text, text, text) from public;
revoke all on function public.receive_warehouse_transfer(text, numeric, text) from public;
revoke all on function public.resolve_warehouse_transfer_line(text, numeric, numeric, text) from public;
grant execute on function public.dispatch_warehouse_transfer(text, text, text, text, text, text, numeric, text, text, text, text) to authenticated;
grant execute on function public.receive_warehouse_transfer(text, numeric, text) to authenticated;
grant execute on function public.resolve_warehouse_transfer_line(text, numeric, numeric, text) to authenticated;

create or replace function public.propose_warehouse_status(
  p_warehouse_gci text,
  p_operational_status text,
  p_history_complete boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_wims_role() not in ('Admin', 'Manager') then
    raise exception 'Hanya Manager atau Admin yang dapat mengajukan status gudang';
  end if;
  if p_operational_status not in ('SETUP', 'OPERATIONAL') then
    raise exception 'Status operasional tidak valid';
  end if;
  if p_operational_status = 'OPERATIONAL' and not exists (
    select 1 from public.warehouse_opening_balances
    where "warehouseGci" = p_warehouse_gci and "status" = 'VERIFIED'
  ) then
    raise exception 'Gudang memerlukan saldo awal terverifikasi sebelum dapat diaktifkan';
  end if;

  update public.warehouses
  set "proposedOperationalStatus" = p_operational_status,
      "proposedHistoryComplete" = p_history_complete,
      "statusProposedBy" = auth.uid(),
      "statusProposedAt" = now()
  where "whGci" = p_warehouse_gci;
  if not found then raise exception 'Gudang tidak ditemukan'; end if;
end;
$$;

create or replace function public.approve_warehouse_status(
  p_warehouse_gci text,
  p_effective_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proposed_status text;
  current_status text;
begin
  if auth.uid() is null or public.current_wims_role() <> 'Admin' then
    raise exception 'Hanya Admin yang dapat mengesahkan status gudang';
  end if;

  select "proposedOperationalStatus", "operationalStatus"
  into proposed_status, current_status
  from public.warehouses
  where "whGci" = p_warehouse_gci
  for update;
  if not found or proposed_status is null then raise exception 'Tidak ada usulan status untuk gudang ini'; end if;

  if proposed_status = 'OPERATIONAL' and current_status <> 'OPERATIONAL' then
    if p_effective_date is null then raise exception 'Tanggal efektif saldo awal wajib diisi'; end if;
    if not exists (
      select 1 from public.warehouse_opening_balances
      where "warehouseGci" = p_warehouse_gci
        and "status" = 'VERIFIED'
        and "effectiveDate" = p_effective_date
    ) then
      raise exception 'Saldo awal terverifikasi pada tanggal efektif tidak ditemukan';
    end if;
  end if;

  update public.warehouses
  set "operationalStatus" = "proposedOperationalStatus",
      "historyComplete" = coalesce("proposedHistoryComplete", "historyComplete"),
      "stockEffectiveDate" = case
        when proposed_status = 'OPERATIONAL' and current_status <> 'OPERATIONAL' then p_effective_date
        else "stockEffectiveDate"
      end,
      "proposedOperationalStatus" = null,
      "proposedHistoryComplete" = null,
      "statusProposedBy" = null,
      "statusProposedAt" = null
  where "whGci" = p_warehouse_gci;
end;
$$;

revoke all on function public.propose_warehouse_status(text, text, boolean) from public;
revoke all on function public.approve_warehouse_status(text, date) from public;
grant execute on function public.propose_warehouse_status(text, text, boolean) to authenticated;
grant execute on function public.approve_warehouse_status(text, date) to authenticated;