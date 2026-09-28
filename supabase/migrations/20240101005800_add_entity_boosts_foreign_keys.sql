-- Migration: Add missing foreign key constraints to entity_boosts table
-- Fixes PostgREST error: "Could not find a relationship between 'entity_boosts' and 'service_providers' in the schema cache"

-- 1. Clean up any orphaned references before adding foreign key constraints
UPDATE public.entity_boosts
SET service_provider_id = NULL
WHERE service_provider_id IS NOT NULL
  AND service_provider_id NOT IN (SELECT service_provider_id FROM public.service_providers);

UPDATE public.entity_boosts
SET vet_id = NULL
WHERE vet_id IS NOT NULL
  AND vet_id NOT IN (SELECT vet_id FROM public.vets);

UPDATE public.entity_boosts
SET pet_friendly_place_id = NULL
WHERE pet_friendly_place_id IS NOT NULL
  AND pet_friendly_place_id NOT IN (SELECT pet_friendly_place_id FROM public.pet_friendly_places);

UPDATE public.entity_boosts
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT user_id FROM public.users);

UPDATE public.entity_boosts
SET boosted_by_user_id = NULL
WHERE boosted_by_user_id IS NOT NULL
  AND boosted_by_user_id NOT IN (SELECT user_id FROM public.users);

-- 2. Add foreign key constraints
ALTER TABLE public.entity_boosts
  DROP CONSTRAINT IF EXISTS entity_boosts_service_provider_id_fkey,
  ADD CONSTRAINT entity_boosts_service_provider_id_fkey
    FOREIGN KEY (service_provider_id)
    REFERENCES public.service_providers(service_provider_id)
    ON DELETE SET NULL;

ALTER TABLE public.entity_boosts
  DROP CONSTRAINT IF EXISTS entity_boosts_vet_id_fkey,
  ADD CONSTRAINT entity_boosts_vet_id_fkey
    FOREIGN KEY (vet_id)
    REFERENCES public.vets(vet_id)
    ON DELETE SET NULL;

ALTER TABLE public.entity_boosts
  DROP CONSTRAINT IF EXISTS entity_boosts_pet_friendly_place_id_fkey,
  ADD CONSTRAINT entity_boosts_pet_friendly_place_id_fkey
    FOREIGN KEY (pet_friendly_place_id)
    REFERENCES public.pet_friendly_places(pet_friendly_place_id)
    ON DELETE SET NULL;

ALTER TABLE public.entity_boosts
  DROP CONSTRAINT IF EXISTS entity_boosts_user_id_fkey,
  ADD CONSTRAINT entity_boosts_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(user_id)
    ON DELETE SET NULL;

ALTER TABLE public.entity_boosts
  DROP CONSTRAINT IF EXISTS entity_boosts_boosted_by_user_id_fkey,
  ADD CONSTRAINT entity_boosts_boosted_by_user_id_fkey
    FOREIGN KEY (boosted_by_user_id)
    REFERENCES public.users(user_id)
    ON DELETE SET NULL;

-- 3. Create indexes on foreign keys to optimize joins
CREATE INDEX IF NOT EXISTS idx_entity_boosts_service_provider_id ON public.entity_boosts(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_vet_id ON public.entity_boosts(vet_id);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_pet_friendly_place_id ON public.entity_boosts(pet_friendly_place_id);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_user_id ON public.entity_boosts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_boosted_by_user_id ON public.entity_boosts(boosted_by_user_id);

-- 4. Reload PostgREST schema cache so embedded resources work immediately
NOTIFY pgrst, 'reload schema';
