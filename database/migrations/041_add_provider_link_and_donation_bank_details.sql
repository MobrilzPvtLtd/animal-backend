-- ============================================================
-- MIGRATION 041: ADD PROVIDER LINK TO PET FRIENDLY PLACES & BANKING DETAILS TO DONATIONS
-- ============================================================

-- 1. Add service_provider_id to pet_friendly_places to link existing providers
ALTER TABLE public.pet_friendly_places 
ADD COLUMN IF NOT EXISTS service_provider_id BIGINT REFERENCES public.service_providers(service_provider_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pet_friendly_places_service_provider_id ON public.pet_friendly_places(service_provider_id);

-- 2. Add Banking Details columns to donation_campaigns table
ALTER TABLE public.donation_campaigns 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS branch_code_swift TEXT;

-- 3. Add Banking Details columns to rescue_centres table
ALTER TABLE public.rescue_centres 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS branch_code_swift TEXT;
