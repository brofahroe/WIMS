-- Approval workflow support
alter table public.transactions add column if not exists "approval_status" text not null default 'APPROVED' check (approval_status in ('PENDING', 'APPROVED', 'REJECTED'));
alter table public.transactions add column if not exists "approved_by" uuid references auth.users(id) on delete set null;
alter table public.transactions add column if not exists "approved_at" timestamp with time zone;

create index if not exists "idx_transactions_approval" on public.transactions("approval_status");
