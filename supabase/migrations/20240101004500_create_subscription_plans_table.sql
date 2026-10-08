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
  'USER_MONTHLY_29',
  'User Monthly Plan',
  'Monthly subscription for pet owners & users to unlock community posts, event reminders, lost pet alerts, and ad-free experience.',
  29.99,
  'ZAR',
  'monthly',
  30,
  '["Create community posts & discussions", "Submit pet events & set reminders", "Lost pet community alerts", "Ad-free experience"]'::jsonb,
  NULL,
  true
),
(
  'MONTHLY_99',
  'Service Provider Monthly Plan',
  'Monthly subscription for service providers. List places, manage rescues, and access the provider dashboard.',
  99.99,
  'ZAR',
  'monthly',
  30,
  '["List and manage service provider profiles", "List up to 5 places & rescues", "Provider dashboard & analytics", "Verified provider badge & support"]'::jsonb,
  'PROVIDER',
  true
),
(
  'YEARLY_899',
  'Service Provider Yearly Plan',
  'Annual subscription for service providers. List places, manage rescues, and access the provider dashboard with 2 months free.',
  899.00,
  'ZAR',
  'yearly',
  365,
  '["Unlimited places & service listings", "Priority Support Access", "2 Months Free", "Verified Badge on listings"]'::jsonb,
  'BEST VALUE',
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
