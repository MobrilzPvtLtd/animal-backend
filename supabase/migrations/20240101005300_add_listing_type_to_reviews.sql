-- Migration 052: Add listing_type column to reviews table and make place_id nullable
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS listing_type TEXT NULL,
ADD COLUMN IF NOT EXISTS listing_id TEXT NULL,
ADD COLUMN IF NOT EXISTS reviewer_name TEXT NULL,
ADD COLUMN IF NOT EXISTS reviewer_image TEXT NULL,
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

ALTER TABLE public.reviews
ALTER COLUMN place_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_type ON public.reviews(listing_type);
