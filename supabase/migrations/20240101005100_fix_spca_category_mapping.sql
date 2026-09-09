-- Migration 050: Fix SPCA category data mapping, standardize active/deleted flags

-- 1. Ensure all service_providers have boolean values for is_deleted and is_active (no NULLs)
UPDATE public.service_providers
SET is_deleted = false
WHERE is_deleted IS NULL;

UPDATE public.service_providers
SET is_active = true
WHERE is_active IS NULL;

-- 2. Link SPCA providers (Edenvale & Sandton) to the SPCA category in service_providers table and junction table
DO $$
DECLARE
  spca_cat_id BIGINT;
BEGIN
  SELECT service_category_id INTO spca_cat_id
  FROM public.service_categories
  WHERE LOWER(name) LIKE '%spca%'
  ORDER BY service_category_id ASC
  LIMIT 1;

  IF spca_cat_id IS NOT NULL THEN
    -- Update SPCA Edenvale & Sandton main category if null or incorrect
    UPDATE public.service_providers
    SET service_category_id = spca_cat_id, is_active = true, is_deleted = false
    WHERE (LOWER(name) LIKE '%spca edenvale%' OR LOWER(name) LIKE '%spca sandton%' OR LOWER(name) LIKE '%edenvale%spca%' OR LOWER(name) LIKE '%sandton%spca%');

    -- Insert junction records for SPCA Edenvale & Sandton if missing
    INSERT INTO public.service_provider_categories (service_provider_id, service_category_id)
    SELECT sp.service_provider_id, spca_cat_id
    FROM public.service_providers sp
    WHERE (LOWER(sp.name) LIKE '%spca edenvale%' OR LOWER(sp.name) LIKE '%spca sandton%' OR LOWER(sp.name) LIKE '%edenvale%spca%' OR LOWER(sp.name) LIKE '%sandton%spca%')
    AND NOT EXISTS (
      SELECT 1 FROM public.service_provider_categories spc
      WHERE spc.service_provider_id = sp.service_provider_id
      AND spc.service_category_id = spca_cat_id
    );

    -- Remove any misassigned SPCA junction entries for non-SPCA transport/travel providers
    DELETE FROM public.service_provider_categories
    WHERE service_category_id = spca_cat_id
    AND service_provider_id IN (
      SELECT service_provider_id FROM public.service_providers
      WHERE (LOWER(name) LIKE '%animal travel%' OR LOWER(name) LIKE '%transport%')
      AND LOWER(name) NOT LIKE '%spca%'
    );
  END IF;
END $$;
