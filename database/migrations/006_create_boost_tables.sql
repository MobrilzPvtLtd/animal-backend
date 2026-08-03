-- Create boost_packages table
create table if not exists public.boost_packages (
  boost_package_id bigint generated always as identity not null,
  name text not null,
  description text null,
  duration_days integer not null default 0,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint boost_packages_pkey primary key (boost_package_id)
) TABLESPACE pg_default;

-- Create entity_boosts table
create table if not exists public.entity_boosts (
  entity_boost_id bigint generated always as identity not null,
  vet_id bigint null,
  breeder_id bigint null,
  pet_friendly_place_id bigint null,
  service_provider_id bigint null,
  user_id bigint null,
  boost_package_id bigint null,
  start_date timestamp with time zone null default now(),
  end_date timestamp with time zone null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint entity_boosts_pkey primary key (entity_boost_id)
) TABLESPACE pg_default;

alter table public.entity_boosts drop constraint if exists entity_boosts_package_id_fkey;
alter table public.entity_boosts
  add constraint entity_boosts_package_id_fkey foreign key (boost_package_id) references public.boost_packages(boost_package_id);
