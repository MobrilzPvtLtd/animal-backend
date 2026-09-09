-- Create service_categories table
create table if not exists public.service_categories (
  service_category_id bigint generated always as identity not null,
  name text not null,
  description text null,
  icon text null,
  color text null,
  is_active boolean null default true,
  sort_order integer null default 0,
  created_at timestamp with time zone not null default now(),
  constraint service_categories_pkey primary key (service_category_id)
) TABLESPACE pg_default;

-- Add sample data for testing (only if not already present)
INSERT INTO public.service_categories (name, description, icon, color, sort_order)
SELECT v.name, v.description, v.icon, v.color, v.sort_order
FROM (VALUES
('Veterinary Services', 'Medical care and health services for animals', '🏥', '#10B981', 1),
('Pet Grooming', 'Professional grooming and styling services', '✂️', '#3B82F6', 2),
('Pet Training', 'Behavioral training and obedience classes', '🎓', '#8B5CF6', 3),
('Pet Boarding', 'Temporary care and accommodation services', '🏨', '#F59E0B', 4),
('Pet Transportation', 'Safe transport services for pets', '🚚', '#EF4444', 5),
('Pet Photography', 'Professional photography services', '📷', '#EC4899', 6)
) AS v(name, description, icon, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_categories sc WHERE sc.name = v.name
);
