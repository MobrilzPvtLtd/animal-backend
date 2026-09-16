-- ============================================================
-- Migration: 057_booster_packages_subscriber_purchase.sql
-- Description:
--   1. Adds `entity_type` column to entity_boosts (home_screen | home_and_group)
--   2. Adds `boosted_by_user_id` – the subscriber who purchased the boost
--   3. Adds `group_boost` boolean – true if the boost also covers Group view
--   4. Adds `transaction_id` FK to link to the payment transaction
--   5. Upserts the 3 official booster packages (R49.99, R99.99, R129.99)
-- ============================================================

-- 1. Add new columns to entity_boosts
ALTER TABLE public.entity_boosts
  ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'service_provider',
  ADD COLUMN IF NOT EXISTS boosted_by_user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_boost BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES public.transactions(transaction_id) ON DELETE SET NULL;

-- 2. Add feature_scope to boost_packages so the app knows where each booster shows
ALTER TABLE public.boost_packages
  ADD COLUMN IF NOT EXISTS feature_scope TEXT DEFAULT 'home_screen';
-- Values: 'home_screen' | 'home_and_group'

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_entity_boosts_boosted_by_user_id ON public.entity_boosts(boosted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_entity_type ON public.entity_boosts(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_group_boost ON public.entity_boosts(group_boost);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_transaction_id ON public.entity_boosts(transaction_id);

-- 4. Remove old placeholder booster packages if they exist and are not linked to any purchase
DELETE FROM public.boost_packages
WHERE name IN ('Visibility Booster', 'Premium Promotion', 'Premium Booster', 'Visibility Booster 2',
               'Silver Boost (7 Days)', 'Gold Boost (30 Days)', 'Platinum Lifetime Boost')
  AND NOT EXISTS (
    SELECT 1 FROM public.entity_boosts eb WHERE eb.boost_package_id = public.boost_packages.boost_package_id
  );

-- 5. Insert the 3 official booster packages (idempotent via name guard)
INSERT INTO public.boost_packages (name, description, duration_days, price, is_active, feature_scope)
SELECT v.name, v.description, v.duration_days, v.price, true, v.feature_scope
FROM (VALUES
  (
    'Visibility Booster',
    'Feather placement for your listed place on the home screen for 30 days.',
    30,
    49.99::NUMERIC,
    'home_screen'
  ),
  (
    'Premium Booster',
    'Feather placement for your listed place on the home screen for 60 days.',
    60,
    99.99::NUMERIC,
    'home_screen'
  ),
  (
    'Visibility Booster 2',
    'Feather placement for your listed place on the home screen AND in the Group view for 30 days.',
    30,
    129.99::NUMERIC,
    'home_and_group'
  )
) AS v(name, description, duration_days, price, feature_scope)
WHERE NOT EXISTS (
  SELECT 1 FROM public.boost_packages bp WHERE bp.name = v.name
);
