-- Migration 055: Add image_url to service_categories to replace icons with images
ALTER TABLE public.service_categories 
ADD COLUMN IF NOT EXISTS image_url TEXT;
