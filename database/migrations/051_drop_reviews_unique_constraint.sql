-- Migration 051: Drop unique constraint on reviews (user_id, place_id) to allow multiple reviews
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_place_id_key;
DROP INDEX IF EXISTS idx_reviews_user_id_place_id;
