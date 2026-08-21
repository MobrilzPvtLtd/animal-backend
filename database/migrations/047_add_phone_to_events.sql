-- Migration 047: Add contact phone column to events table

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS phone TEXT NULL;
