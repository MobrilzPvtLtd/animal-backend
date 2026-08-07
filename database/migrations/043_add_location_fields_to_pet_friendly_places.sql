-- ============================================================
-- MIGRATION 043: CLEANUP PET FRIENDLY PLACES LOCATION & IMAGES COLUMNS
-- ============================================================

-- 1. TRUNCATE pet_friendly_places table to clear existing test data
TRUNCATE TABLE public.pet_friendly_places CASCADE;

-- 2. Drop location_id foreign key & column from pet_friendly_places
ALTER TABLE public.pet_friendly_places
DROP COLUMN IF EXISTS location_id;

-- 3. Add direct location & multiple images columns to pet_friendly_places
ALTER TABLE public.pet_friendly_places
ADD COLUMN IF NOT EXISTS latitude FLOAT NULL,
ADD COLUMN IF NOT EXISTS longitude FLOAT NULL,
ADD COLUMN IF NOT EXISTS show_publicly BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
