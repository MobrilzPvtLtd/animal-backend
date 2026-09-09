-- ============================================================
-- Migration: 046_add_subscription_plan_id_to_transactions.sql
-- Description: Adds subscription_plan_id column to public.transactions table
-- ============================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS subscription_plan_id BIGINT REFERENCES public.subscription_plans(subscription_plan_id) ON DELETE SET NULL;

-- Create index for subscription_plan_id for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_plan_id ON public.transactions (subscription_plan_id);
