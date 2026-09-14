-- Script to fix the column names in Supabase to match the application code (camelCase).
-- You can copy and paste this into the Supabase SQL Editor and click "Run".

DO $$
BEGIN
  -- 1. Rename existing snake_case columns if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approval_status') THEN
    ALTER TABLE public.transactions RENAME COLUMN "approval_status" TO "approvalStatus";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approved_by') THEN
    ALTER TABLE public.transactions RENAME COLUMN "approved_by" TO "approvedBy";
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approved_at') THEN
    ALTER TABLE public.transactions RENAME COLUMN "approved_at" TO "approvedAt";
  END IF;

  -- 2. If the columns do not exist at all, add them
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approvalStatus') THEN
    ALTER TABLE public.transactions ADD COLUMN "approvalStatus" text not null default 'APPROVED' check ("approvalStatus" in ('PENDING', 'APPROVED', 'REJECTED'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approvedBy') THEN
    ALTER TABLE public.transactions ADD COLUMN "approvedBy" uuid references auth.users(id) on delete set null;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='approvedAt') THEN
    ALTER TABLE public.transactions ADD COLUMN "approvedAt" timestamp with time zone;
  END IF;
END $$;

-- 3. Recreate the index on the new column name
DROP INDEX IF EXISTS public.idx_transactions_approval;
CREATE INDEX IF NOT EXISTS "idx_transactions_approval" ON public.transactions("approvalStatus");
