-- Migration 059: Update subscription plans pricing (User: R29.99/mo, Service Provider: R99.99/mo)

-- 1. Ensure User Monthly Plan exists at R29.99
INSERT INTO public.subscription_plans (
  plan_code, 
  name, 
  description, 
  price, 
  currency, 
  billing_cycle, 
  duration_days, 
  features, 
  badge_text, 
  is_active
)
VALUES (
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
)
ON CONFLICT (plan_code) DO UPDATE 
SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  features = EXCLUDED.features,
  badge_text = EXCLUDED.badge_text,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Update existing Service Provider Monthly Plan (MONTHLY_99) to R99.99
UPDATE public.subscription_plans
SET 
  name = 'Service Provider Monthly Plan',
  description = 'Monthly subscription for service providers. List places, manage rescues, and access the provider dashboard.',
  price = 99.99,
  currency = 'ZAR',
  billing_cycle = 'monthly',
  duration_days = 30,
  badge_text = 'PROVIDER',
  features = '["List and manage service provider profiles", "List up to 5 places & rescues", "Provider dashboard & analytics", "Verified provider badge & support"]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE plan_code = 'MONTHLY_99';

-- 3. Update existing Service Provider Yearly Plan (YEARLY_899)
UPDATE public.subscription_plans
SET 
  name = 'Service Provider Yearly Plan',
  description = 'Annual subscription for service providers. List places, manage rescues, and access the provider dashboard with 2 months free.',
  badge_text = 'BEST VALUE',
  features = '["Unlimited places & service listings", "Priority Support Access", "2 Months Free", "Verified Badge on listings"]'::jsonb,
  is_active = true,
  updated_at = NOW()
WHERE plan_code = 'YEARLY_899';
