-- Migration 046: Add support for reviews listing_id, reviewer info, likes and place contribution fields

-- 1. Add fields to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS listing_id TEXT NULL,
ADD COLUMN IF NOT EXISTS reviewer_name TEXT NULL,
ADD COLUMN IF NOT EXISTS reviewer_image TEXT NULL,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Create index for listing_id lookup
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);

-- 2. Add fields to pet_friendly_places table
ALTER TABLE public.pet_friendly_places
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS place_type TEXT NULL;
