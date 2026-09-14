-- Approval workflow support
alter table public.transactions add column if not exists "approvalStatus" text not null default 'APPROVED' check ("approvalStatus" in ('PENDING', 'APPROVED', 'REJECTED'));
alter table public.transactions add column if not exists "approvedBy" uuid references auth.users(id) on delete set null;
alter table public.transactions add column if not exists "approvedAt" timestamp with time zone;

create index if not exists "idx_transactions_approval" on public.transactions("approvalStatus");
