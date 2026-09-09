-- Migration 039: Support linking multiple categories to a service provider
CREATE TABLE IF NOT EXISTS public.service_provider_categories (
    service_provider_id BIGINT REFERENCES public.service_providers(service_provider_id) ON DELETE CASCADE,
    service_category_id BIGINT REFERENCES public.service_categories(service_category_id) ON DELETE CASCADE,
    PRIMARY KEY (service_provider_id, service_category_id)
);

-- Backfill initial category relation from service_providers table
INSERT INTO public.service_provider_categories (service_provider_id, service_category_id)
SELECT service_provider_id, service_category_id 
FROM public.service_providers 
WHERE service_category_id IS NOT NULL
ON CONFLICT DO NOTHING;
