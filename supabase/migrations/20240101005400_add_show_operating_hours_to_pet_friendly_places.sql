-- Migration 053: Add show_operating_hours column to pet_friendly_places and service_providers
ALTER TABLE public.pet_friendly_places 
ADD COLUMN IF NOT EXISTS show_operating_hours BOOLEAN DEFAULT TRUE;

ALTER TABLE public.service_providers 
ADD COLUMN IF NOT EXISTS show_operating_hours BOOLEAN DEFAULT TRUE;
