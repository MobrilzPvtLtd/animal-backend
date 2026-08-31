-- Migration 045: Create subscription_plans table and seed default plans

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  subscription_plan_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  plan_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly' | 'one_time'
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  badge_text TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (subscription_plan_id)
) TABLESPACE pg_default;

-- RLS & Permissions setup
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read active subscription plans" ON public.subscription_plans;
CREATE POLICY "Allow public read active subscription plans" 
  ON public.subscription_plans FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow admin modify subscription plans" ON public.subscription_plans;
CREATE POLICY "Allow admin modify subscription plans" 
  ON public.subscription_plans FOR ALL 
  USING (true) WITH CHECK (true);

-- Seed initial default plans matching the mobile app design
INSERT INTO public.subscription_plans (plan_code, name, description, price, currency, billing_cycle, duration_days, features, badge_text, is_active)
VALUES 
(
  'MONTHLY_99',
  'Monthly Plan',
  'Subscribe to list your places, manage rescues, and access the provider dashboard.',
  99.00,
  'ZAR',
  'monthly',
  30,
  '["List up to 5 places", "Basic Analytics", "Support Access"]'::jsonb,
  NULL,
  true
),
(
  'YEARLY_899',
  'Yearly Plan',
  'Subscribe to list your places, manage rescues, and access the provider dashboard.',
  899.00,
  'ZAR',
  'yearly',
  365,
  '["Unlimited places", "Priority Support", "2 Months Free", "Verified Badge"]'::jsonb,
  'MOST POPULAR',
  true
)
ON CONFLICT (plan_code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  features = EXCLUDED.features,
  badge_text = EXCLUDED.badge_text,
  updated_at = NOW();
