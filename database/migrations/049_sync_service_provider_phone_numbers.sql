-- Migration 049: Sync emergency_number on public.service_providers with phone if emergency_number is null, empty, or outdated

UPDATE public.service_providers
SET emergency_number = phone
WHERE phone IS NOT NULL AND phone != '' AND (emergency_number IS NULL OR emergency_number = '');
