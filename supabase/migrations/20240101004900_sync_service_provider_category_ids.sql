-- Migration 048: Sync primary service_category_id on public.service_providers from junction table

UPDATE public.service_providers sp
SET service_category_id = (
  SELECT spc.service_category_id
  FROM public.service_provider_categories spc
  WHERE spc.service_provider_id = sp.service_provider_id
  ORDER BY spc.service_category_id ASC
  LIMIT 1
)
WHERE sp.service_category_id IS NULL;
