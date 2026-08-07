-- ============================================================
-- MIGRATION 045: SAFE MULTIPLE IMAGES COLUMN ADDITION TO ALL ENTITY TABLES
-- ============================================================

DO $$
BEGIN
    -- Add images column to public.vets if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vets') THEN
        ALTER TABLE public.vets ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.breeders if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'breeders') THEN
        ALTER TABLE public.breeders ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.events if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        ALTER TABLE public.events ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.service_providers if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_providers') THEN
        ALTER TABLE public.service_providers ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.pet_friendly_places if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pet_friendly_places') THEN
        ALTER TABLE public.pet_friendly_places ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;
END $$;