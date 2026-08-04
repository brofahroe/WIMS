-- Enable Supabase Realtime for transactions table
-- Run this in Supabase SQL Editor

alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.audit_trail;
