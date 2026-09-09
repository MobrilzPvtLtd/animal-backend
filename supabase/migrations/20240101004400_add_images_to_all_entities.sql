-- ============================================================
-- MIGRATION 045: SAFE MULTIPLE IMAGES COLUMN ADDITION TO ALL ENTITY TABLES
-- ============================================================

DO $$
BEGIN
    -- Add images column to public.pet_friendly_places if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pet_friendly_places') THEN
        ALTER TABLE public.pet_friendly_places ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.animal_types if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'animal_types') THEN
        ALTER TABLE public.animal_types ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.breeds if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'breeds') THEN
        ALTER TABLE public.breeds ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.whats_new if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whats_new') THEN
        ALTER TABLE public.whats_new ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

    -- Add images column to public.community_posts if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_posts') THEN
        ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
    END IF;

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
END $$;