
-- ============================================================
-- Migration: 001_create_permissions_roles_tables.sql
-- ============================================================

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    permission_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    role_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INTEGER REFERENCES public.roles(role_id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES public.permissions(permission_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
('dashboard.view', 'View dashboard', 'dashboard', 'read'),
('users.view', 'View users', 'users', 'read'),
('users.create', 'Create users', 'users', 'create'),
('users.update', 'Update users', 'users', 'update'),
('users.delete', 'Delete users', 'users', 'delete'),
('users.manage_roles', 'Manage user roles', 'users', 'manage_roles'),
('subscriptions.view', 'View subscription status', 'subscriptions', 'read'),
('subscriptions.update', 'Update subscription status', 'subscriptions', 'update'),
('profiles.view', 'View user profiles', 'profiles', 'read'),
('profiles.update', 'Update user profiles', 'profiles', 'update'),
('groups.view', 'View groups', 'groups', 'read'),
('groups.create', 'Create groups', 'groups', 'create'),
('groups.update', 'Update groups', 'groups', 'update'),
('groups.delete', 'Delete or deactivate groups', 'groups', 'delete'),
('places.view', 'View places', 'places', 'read'),
('places.create', 'Create places', 'places', 'create'),
('places.update', 'Update places', 'places', 'update'),
('places.delete', 'Delete or deactivate places', 'places', 'delete'),
('places.manage_mapping', 'Manage multi-group place mapping', 'places', 'manage_mapping'),
('events.view', 'View events', 'events', 'read'),
('events.create', 'Create events', 'events', 'create'),
('events.update', 'Update events', 'events', 'update'),
('events.delete', 'Delete events', 'events', 'delete'),
('events.approve', 'Approve submitted events', 'events', 'approve'),
('events.expire', 'Expire past events', 'events', 'update'),
('community.view', 'View community posts', 'community', 'read'),
('community.create', 'Create community posts', 'community', 'create'),
('community.update', 'Update community posts', 'community', 'update'),
('community.delete', 'Delete community posts', 'community', 'delete'),
('community.moderate', 'Moderate community content', 'community', 'moderate'),
('reviews.view', 'View reviews', 'reviews', 'read'),
('reviews.create', 'Create reviews', 'reviews', 'create'),
('reviews.update', 'Update reviews', 'reviews', 'update'),
('reviews.delete', 'Delete reviews', 'reviews', 'delete'),
('reviews.approve', 'Approve reviews', 'reviews', 'approve'),
('providers.request_access', 'Request provider access', 'providers', 'create'),
('providers.verify', 'Verify provider ownership', 'providers', 'verify'),
('providers.edit', 'Edit provider place info', 'providers', 'update'),
('providers.promotions', 'Manage provider promotions', 'providers', 'promotions'),
('donations.view', 'View donation campaigns', 'donations', 'read'),
('donations.create', 'Create donation campaigns', 'donations', 'create'),
('donations.update', 'Update donation campaigns', 'donations', 'update'),
('donations.delete', 'Delete donation campaigns', 'donations', 'delete'),
('boosters.view', 'View booster packages', 'boosters', 'read'),
('boosters.create', 'Create booster packages', 'boosters', 'create'),
('boosters.update', 'Update booster packages', 'boosters', 'update'),
('boosters.delete', 'Delete booster packages', 'boosters', 'delete'),
('support.view', 'View support tickets', 'support', 'read'),
('support.create', 'Create support tickets', 'support', 'create'),
('support.update', 'Update support tickets', 'support', 'update'),
('support.respond', 'Respond to support tickets', 'support', 'respond'),
('notifications.view', 'View notifications', 'notifications', 'read'),
('notifications.create', 'Create notifications', 'notifications', 'create'),
('notifications.send', 'Send notifications', 'notifications', 'send'),
('analytics.view', 'View analytics', 'analytics', 'read'),
('audit_logs.view', 'View audit logs', 'audit_logs', 'read'),
('audit_logs.create', 'Record audit logs', 'audit_logs', 'create'),
('search.view', 'Search across groups, places, events, breeds', 'search', 'read')
ON CONFLICT (name) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name, description, is_system_role) VALUES
('Guest', 'Non-subscriber guest access', false),
('Subscriber', 'Subscriber with feature access', false),
('Provider', 'Linked place owner / provider access', false),
('Admin', 'Administrative access with broad permissions', true),
('Approver', 'Approval and moderation access', true),
('Manager', 'Management access for groups, places, and content', true),
('Owner', 'Super admin access with full system control', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Owner gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Owner'
ON CONFLICT DO NOTHING;

-- Admin gets all permissions except audit log creation and owner-only access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Admin' AND p.name != 'audit_logs.create'
ON CONFLICT DO NOTHING;

-- Manager gets dashboard, groups, places, events, reviews, donations, boosters, support, notifications, analytics, and search access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Manager'
  AND p.resource IN (
    'dashboard', 'groups', 'places', 'events', 'reviews', 'donations', 'boosters', 'support', 'notifications', 'analytics', 'search'
  )
  AND p.action IN ('read', 'create', 'update', 'approve', 'respond')
ON CONFLICT DO NOTHING;

-- Approver can view and approve content, review moderation, support, and analytics
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Approver'
  AND p.resource IN ('dashboard', 'events', 'reviews', 'community', 'support', 'analytics', 'search')
  AND p.action IN ('read', 'approve', 'moderate', 'respond')
ON CONFLICT DO NOTHING;

-- Provider can manage their linked place and promotions, view groups/places/search
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Provider'
  AND p.name IN (
    'places.view',
    'places.update',
    'providers.edit',
    'providers.promotions',
    'search.view',
    'groups.view',
    'dashboard.view'
  )
ON CONFLICT DO NOTHING;

-- Subscriber can use subscription features, create events, community, reviews, support, and search
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Subscriber'
  AND p.name IN (
    'dashboard.view',
    'subscriptions.view',
    'profiles.view',
    'profiles.update',
    'events.view',
    'events.create',
    'community.view',
    'community.create',
    'community.update',
    'reviews.view',
    'reviews.create',
    'support.view',
    'support.create',
    'search.view'
  )
ON CONFLICT DO NOTHING;

-- Guest has minimal public/search access and support creation
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Guest'
  AND p.name IN (
    'dashboard.view',
    'subscriptions.view',
    'profiles.view',
    'groups.view',
    'places.view',
    'events.view',
    'community.view',
    'reviews.view',
    'donations.view',
    'support.create',
    'search.view'
  )
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);



-- ============================================================
-- Migration: 002_update_permissions_system.sql
-- ============================================================

-- =============================
-- 1. CREATE USERS TABLE (IF NOT EXISTS)
-- =============================
CREATE TABLE IF NOT EXISTS public.users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    password TEXT,
    surname TEXT,
    phone TEXT,
    device_type TEXT,
    profile_image_url TEXT,
    auth_user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================
-- 2. CREATE USER ROLES TABLE (IF NOT EXISTS)
-- =============================
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    role_id BIGINT REFERENCES public.roles(role_id) ON DELETE CASCADE,
    vet_id BIGINT NULL,
    breeder_id BIGINT NULL,
    pet_friendly_place_id BIGINT NULL,
    service_provider_id BIGINT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- =============================
-- 3. ADD ADDITIONAL PERMISSIONS (only new ones)
-- =============================
INSERT INTO public.permissions (name, description, resource, action) VALUES
('pet_friendly_places.view', 'View pet friendly places', 'pet_friendly_places', 'read'),
('pet_friendly_places.create', 'Create pet friendly places', 'pet_friendly_places', 'create'),
('pet_friendly_places.update', 'Update pet friendly places', 'pet_friendly_places', 'update'),
('pet_friendly_places.delete', 'Delete pet friendly places', 'pet_friendly_places', 'delete'),
('events.view', 'View events', 'events', 'read'),
('events.create', 'Create events', 'events', 'create'),
('events.update', 'Update events', 'events', 'update'),
('events.delete', 'Delete events', 'events', 'delete'),
('help_requests.view', 'View help requests', 'help_requests', 'read'),
('help_requests.create', 'Create help requests', 'help_requests', 'create'),
('help_requests.update', 'Update help requests', 'help_requests', 'update'),
('help_requests.delete', 'Delete help requests', 'help_requests', 'delete'),
('posts.view', 'View posts', 'posts', 'read'),
('posts.create', 'Create posts', 'posts', 'create'),
('posts.update', 'Update posts', 'posts', 'update'),
('posts.delete', 'Delete posts', 'posts', 'delete'),
('reviews.view', 'View reviews', 'reviews', 'read'),
('reviews.create', 'Create reviews', 'reviews', 'create'),
('reviews.update', 'Update reviews', 'reviews', 'update'),
('reviews.delete', 'Delete reviews', 'reviews', 'delete'),
('notifications.view', 'View notifications', 'notifications', 'read'),
('notifications.create', 'Create notifications', 'notifications', 'create'),
('notifications.update', 'Update notifications', 'notifications', 'update'),
('notifications.delete', 'Delete notifications', 'notifications', 'delete')
ON CONFLICT (name) DO NOTHING;

-- =============================
-- 4. ASSIGN ADMIN PERMISSIONS
-- =============================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.roles r, public.permissions p
WHERE r.name = 'Admin' AND p.name != 'users.delete'
ON CONFLICT DO NOTHING;

-- =============================
-- 5. ASSIGN MANAGER PERMISSIONS
-- =============================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.roles r, public.permissions p
WHERE r.name = 'Manager' AND p.action IN ('read', 'create', 'update')
ON CONFLICT DO NOTHING;


-- =============================
-- 6. CREATE INDEXES
-- =============================
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON public.permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);


-- ============================================================
-- Migration: 003_entity_specific_roles.sql
-- ============================================================

-- =============================
-- 1. ADD MISSING COLUMN TO ROLES TABLE (IF NOT EXISTS)
-- =============================
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT FALSE;

-- =============================
-- 2. CREATE USER ROLES TABLE (IF NOT EXISTS)
-- =============================
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    role_id BIGINT REFERENCES public.roles(role_id) ON DELETE CASCADE,
    vet_id BIGINT NULL,
    breeder_id BIGINT NULL,
    pet_friendly_place_id BIGINT NULL,
    service_provider_id BIGINT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- =============================
-- 3. INSERT ADDITIONAL PERMISSIONS (ONLY NEW ONES)
-- =============================
INSERT INTO public.permissions (name, description, resource, action) VALUES
-- Breeder specific permissions
('breeder.manage', 'Manage specific breeder', 'breeder', 'manage'),
('breeder.view', 'View specific breeder', 'breeder', 'read'),
('breeder.update', 'Update specific breeder', 'breeder', 'update'),

-- Veterinarian specific permissions
('vet.manage', 'Manage specific vet', 'vet', 'manage'),
('vet.view', 'View specific vet', 'vet', 'read'),
('vet.update', 'Update specific vet', 'vet', 'update'),

-- Service Provider specific permissions
('service_provider.manage', 'Manage specific service provider', 'service_provider', 'manage'),
('service_provider.view', 'View specific service provider', 'service_provider', 'read'),
('service_provider.update', 'Update specific service provider', 'service_provider', 'update'),

-- Pet Friendly Place specific permissions
('pet_friendly_place.manage', 'Manage specific pet friendly place', 'pet_friendly_place', 'manage'),
('pet_friendly_place.view', 'View specific pet friendly place', 'pet_friendly_place', 'read'),
('pet_friendly_place.update', 'Update specific pet friendly place', 'pet_friendly_place', 'update'),

-- Animal Types permissions
('animal_types.view', 'View animal types', 'animal_types', 'read'),
('animal_types.create', 'Create animal types', 'animal_types', 'create'),
('animal_types.update', 'Update animal types', 'animal_types', 'update'),
('animal_types.delete', 'Delete animal types', 'animal_types', 'delete'),

-- Help Requests permissions
('help_requests.view', 'View help requests', 'help_requests', 'read'),
('help_requests.create', 'Create help requests', 'help_requests', 'create'),
('help_requests.update', 'Update help requests', 'help_requests', 'update'),
('help_requests.delete', 'Delete help requests', 'help_requests', 'delete'),

-- Posts permissions
('posts.view', 'View posts', 'posts', 'read'),
('posts.create', 'Create posts', 'posts', 'create'),
('posts.update', 'Update posts', 'posts', 'update'),
('posts.delete', 'Delete posts', 'posts', 'delete'),

-- Reviews permissions
('reviews.view', 'View reviews', 'reviews', 'read'),
('reviews.create', 'Create reviews', 'reviews', 'create'),
('reviews.update', 'Update reviews', 'reviews', 'update'),
('reviews.delete', 'Delete reviews', 'reviews', 'delete'),

-- Notifications permissions
('notifications.view', 'View notifications', 'notifications', 'read'),
('notifications.create', 'Create notifications', 'notifications', 'create'),
('notifications.update', 'Update notifications', 'notifications', 'update'),
('notifications.delete', 'Delete notifications', 'notifications', 'delete')
ON CONFLICT (name) DO NOTHING;

-- =============================
-- 4. INSERT ADDITIONAL ROLES (IF NOT EXISTS)
-- =============================
-- No additional roles inserted here; role set is centralized in migration 001.

-- =============================
-- 5. ASSIGN MANAGER PERMISSIONS (UPDATED)
-- =============================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.roles r, public.permissions p
WHERE r.name = 'Manager' AND (
  p.action IN ('read', 'create', 'update') OR 
  p.resource IN ('breeder', 'vet', 'service_provider', 'pet_friendly_place')
)
ON CONFLICT DO NOTHING;

-- =============================
-- 6. ASSIGN OWNER PERMISSIONS
-- =============================
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM public.roles r, public.permissions p
WHERE r.name = 'Owner' AND p.resource IN ('breeder', 'vet', 'service_provider', 'pet_friendly_place')
ON CONFLICT DO NOTHING;

-- =============================
-- 7. ASSIGN STAFF PERMISSIONS
-- =============================
-- 'Staff' role removed from canonical set; skip staff permission assignments.

-- =============================
-- 8. ASSIGN MODERATOR PERMISSIONS
-- =============================
-- 'Moderator' role removed from canonical set; skip moderator assignments.

-- =============================
-- 9. CREATE INDEXES
-- =============================
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON public.permissions(resource, action);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- =============================
-- 10. CREATE COMPOSITE INDEX FOR ENTITY LOOKUPS (ONLY IF COLUMNS EXIST)
-- =============================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'vet_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_user_roles_entity_ids ON public.user_roles(vet_id, breeder_id, pet_friendly_place_id, service_provider_id);
    END IF;
END $$;


-- ============================================================
-- Migration: 004_add_emergency_number_to_vets.sql
-- ============================================================

-- =============================
-- FILE 4: ENTITY TABLES
-- =============================


-- =============================
-- 2. VETS TABLE (WITH EMERGENCY NUMBER)
-- =============================
CREATE TABLE IF NOT EXISTS public.vets (
    vet_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    clinic_name TEXT,
    description TEXT,
    address TEXT,
    phone TEXT,
    emergency_number TEXT,
    email TEXT,
    specialization TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN public.vets.emergency_number IS 'Emergency contact number for urgent situations';

-- =============================
-- 3. SERVICE PROVIDERS TABLE
-- =============================
CREATE TABLE IF NOT EXISTS public.service_providers (
    service_provider_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    service_type TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================
-- 4. PET FRIENDLY PLACES TABLE
-- =============================
CREATE TABLE IF NOT EXISTS public.pet_friendly_places (
    pet_friendly_place_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    place_type TEXT,
    price_range TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================
-- 5. CREATE INDEXES FOR ALL ENTITY TABLES
-- =============================
CREATE INDEX IF NOT EXISTS idx_vets_user_id ON public.vets(user_id);
CREATE INDEX IF NOT EXISTS idx_service_providers_user_id ON public.service_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_pet_friendly_places_user_id ON public.pet_friendly_places(user_id);


-- ============================================================
-- Migration: 005_create_service_categories_table.sql
-- ============================================================

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

-- Add some sample data for testing
INSERT INTO public.service_categories (name, description, icon, color, sort_order) VALUES
('Veterinary Services', 'Medical care and health services for animals', 'ðŸ¥', '#10B981', 1),
('Pet Grooming', 'Professional grooming and styling services', 'âœ‚ï¸', '#3B82F6', 2),
('Pet Training', 'Behavioral training and obedience classes', 'ðŸŽ“', '#8B5CF6', 3),
('Pet Boarding', 'Temporary care and accommodation services', 'ðŸ ', '#F59E0B', 4),
('Pet Transportation', 'Safe transport services for pets', 'ðŸš—', '#EF4444', 5),
('Pet Photography', 'Professional photography services', 'ðŸ“¸', '#EC4899', 6);



-- ============================================================
-- Migration: 006_create_boost_tables.sql
-- ============================================================

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



-- ============================================================
-- Migration: 007_add_user_name_column.sql
-- ============================================================

-- =============================
-- FILE 6: CORE ENTITY TABLES AND SEED DATA
-- =============================
-- 1. EXTEND USERS TABLE FOR PROFILE & SUBSCRIPTION FIELDS
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'guest',
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS static_location TEXT,
ADD COLUMN IF NOT EXISTS latitude FLOAT NULL,
ADD COLUMN IF NOT EXISTS longitude FLOAT NULL,
ADD COLUMN IF NOT EXISTS preferred_radius INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"events": true, "warnings": true, "updates": true}',
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'guest',
ADD COLUMN IF NOT EXISTS user_name TEXT GENERATED ALWAYS AS (name || ' ' || surname) STORED;
CREATE INDEX IF NOT EXISTS idx_users_user_name ON public.users(user_name);

-- 2. GROUPS TABLE
CREATE TABLE IF NOT EXISTS public.groups (
    group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 3. PLACE GROUP MAPPING TABLE
CREATE TABLE IF NOT EXISTS public.place_groups (
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES public.groups(group_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (place_id, group_id)
);
-- 4. ANIMAL TYPES TABLE
CREATE TABLE IF NOT EXISTS public.animal_types (
    animal_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 5. PLACE ANIMAL TYPES MAPPING TABLE
CREATE TABLE IF NOT EXISTS public.place_animal_types (
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    animal_type_id BIGINT REFERENCES public.animal_types(animal_type_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (place_id, animal_type_id)
);
-- 6. EVENT CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.event_categories (
    event_category_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 7. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
    event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    venue TEXT NOT NULL,
    location TEXT,
    expiry TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    service_provider_id BIGINT REFERENCES public.service_providers(service_provider_id) ON DELETE SET NULL,
    event_category_id BIGINT REFERENCES public.event_categories(event_category_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 8. COMMUNITY POSTS TABLE
CREATE TABLE IF NOT EXISTS public.community_posts (
    post_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    title TEXT,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 9. POST LIKES TABLE
CREATE TABLE IF NOT EXISTS public.post_likes (
    post_id BIGINT REFERENCES public.community_posts(post_id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);
-- 10. USER BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.user_blocks (
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    blocked_user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, blocked_user_id)
);
-- 11. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, place_id)
);
-- 12. PROVIDER ACCESS REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.provider_requests (
    request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 13. RESCUE CENTRES TABLE
CREATE TABLE IF NOT EXISTS public.rescue_centres (
    rescue_centre_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 14. DONATION CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.donation_campaigns (
    campaign_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rescue_centre_id BIGINT REFERENCES public.rescue_centres(rescue_centre_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    monthly_target NUMERIC(12,2),
    visible BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 15. BOOST PACKAGES TABLE
CREATE TABLE IF NOT EXISTS public.boost_packages (
    boost_package_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER DEFAULT 30,
    price NUMERIC(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 16. BOOST PACKAGE LINKING TABLE
CREATE TABLE IF NOT EXISTS public.boost_package_links (
    boost_package_id BIGINT REFERENCES public.boost_packages(boost_package_id) ON DELETE CASCADE,
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES public.groups(group_id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (boost_package_id, place_id, group_id)
);
-- 17. ENTITY BOOSTS TABLE
CREATE TABLE IF NOT EXISTS public.entity_boosts (
    entity_boost_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    boost_package_id BIGINT REFERENCES public.boost_packages(boost_package_id) ON DELETE SET NULL,
    vet_id BIGINT REFERENCES public.vets(vet_id) ON DELETE SET NULL,
    pet_friendly_place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE SET NULL,
    service_provider_id BIGINT REFERENCES public.service_providers(service_provider_id) ON DELETE SET NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 18. SAVED PLACES TABLE
CREATE TABLE IF NOT EXISTS public.saved_places (
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE CASCADE,
    place_id BIGINT REFERENCES public.pet_friendly_places(pet_friendly_place_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, place_id)
);
-- 18. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
    support_ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    initial_message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    last_reply_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 19. SUPPORT REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.support_replies (
    support_reply_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    support_ticket_id BIGINT REFERENCES public.support_tickets(support_ticket_id) ON DELETE CASCADE,
    reply TEXT NOT NULL,
    responder_user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 20. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    target TEXT DEFAULT 'all',
    level TEXT DEFAULT 'info',
    send_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 21. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    audit_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    details JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 22. INDEXES
CREATE INDEX IF NOT EXISTS idx_groups_is_active ON public.groups(is_active);
CREATE INDEX IF NOT EXISTS idx_place_groups_place_id ON public.place_groups(place_id);
CREATE INDEX IF NOT EXISTS idx_place_groups_group_id ON public.place_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_place_animal_types_place_id ON public.place_animal_types(place_id);
CREATE INDEX IF NOT EXISTS idx_animal_types_name ON public.animal_types(name);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON public.events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_is_approved ON public.events(is_approved);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_place_user ON public.reviews(place_id, user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_boost_packages_is_active ON public.boost_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_active ON public.entity_boosts(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_boosts_package_id ON public.entity_boosts(boost_package_id);
-- 23. DUMMY USERS
INSERT INTO public.users (email, name, surname, password, phone, profile_image_url, subscription_status, subscription_plan, subscription_expires_at, static_location, preferred_radius, user_type)
VALUES
('guest@example.com', 'Guest', 'User', 'guestpass', '0100000000', null, 'guest', null, null, 'Cape Town, South Africa', 10, 'Guest'),
('subscriber@example.com', 'Subscriber', 'Member', 'subscriberpass', '0100000001', null, 'active', 'basic', NOW() + INTERVAL '30 days', 'Johannesburg, South Africa', 20, 'Subscriber'),
('provider@example.com', 'Provider', 'Owner', 'providerpass', '0100000002', null, 'active', 'business', NOW() + INTERVAL '90 days', 'Pretoria, South Africa', 15, 'Provider'),
('admin@example.com', 'Admin', 'User', 'adminpass', '0100000003', null, 'active', 'enterprise', NOW() + INTERVAL '365 days', 'Durban, South Africa', 50, 'Admin'),
('approver@example.com', 'Approver', 'User', 'approverpass', '0100000004', null, 'active', 'pro', NOW() + INTERVAL '365 days', 'Port Elizabeth, South Africa', 30, 'Approver'),
('manager@example.com', 'Manager', 'User', 'managerpass', '0100000005', null, 'active', 'pro', NOW() + INTERVAL '365 days', 'Stellenbosch, South Africa', 40, 'Manager'),
('owner@example.com', 'Owner', 'User', 'ownerpass', '0100000006', null, 'active', 'enterprise', NOW() + INTERVAL '365 days', 'Sandton, South Africa', 60, 'Owner'),
('superadmin@gmail.com', 'Super', 'Admin', 'SuperAdmin@123', '0100000007', null, 'active', 'enterprise', NOW() + INTERVAL '365 days', 'Cape Town, South Africa', 100, 'Owner')
ON CONFLICT (email) DO NOTHING;
-- 24. ASSIGN ROLES TO DUMMY USERS
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Guest'
WHERE u.email = 'guest@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Subscriber'
WHERE u.email = 'subscriber@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Provider'
WHERE u.email = 'provider@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Admin'
WHERE u.email = 'admin@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Approver'
WHERE u.email = 'approver@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Manager'
WHERE u.email = 'manager@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Owner'
WHERE u.email = 'owner@example.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name = 'Owner'
WHERE u.email = 'superadmin@gmail.com'
ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role_id, created_at)
SELECT u.user_id, r.role_id, NOW()
FROM public.users u
JOIN public.roles r ON r.name IN ('Guest', 'Subscriber', 'Provider', 'Admin', 'Approver', 'Manager', 'Owner')
WHERE u.email = 'superadmin@gmail.com'
ON CONFLICT DO NOTHING;
-- 25. DUMMY GROUPS
INSERT INTO public.groups (name, description) VALUES
('Pet Friendly Accommodation', 'Places that welcome pets while you travel or work.'),
('Animal Welfare & Rescue', 'Rescue centers and verified shelters supporting animals.'),
('Pet Events & Training', 'Events, classes, and community meetups for pet owners.'),
('Veterinary & Grooming Services', 'Professional veterinary, grooming and healthcare services.')
ON CONFLICT (name) DO NOTHING;
-- 26. DUMMY ANIMAL TYPES
INSERT INTO public.animal_types (name, description) VALUES
('Dogs', 'All dog-focused services and places.'),
('Cats', 'Cat-friendly places and services.'),
('Birds', 'Services and places for bird owners.'),
('Small Pets', 'Small mammals and exotic pet services.')
ON CONFLICT (name) DO NOTHING;
-- 27. DUMMY SERVICE PROVIDERS
INSERT INTO public.service_providers (name, description, address, phone, email, website, service_type, is_verified, user_id)
SELECT v.name, v.description, v.address, v.phone, v.email, v.website, v.service_type, v.is_verified, v.user_id
FROM (VALUES
('Healthy Paws Clinic', 'Full veterinary care for dogs and cats.', '22 Health Street, Cape Town', '0215559001', 'info@healthypaws.example.com', 'https://healthypaws.example.com', 'Veterinary', true, (SELECT user_id FROM public.users WHERE email = 'provider@example.com')),
('Groom & Go', 'Professional grooming and styling for all pets.', '14 Pet Lane, Johannesburg', '0115559002', 'hello@groomandgo.example.com', 'https://groomandgo.example.com', 'Grooming', true, (SELECT user_id FROM public.users WHERE email = 'provider@example.com'))
) AS v(name, description, address, phone, email, website, service_type, is_verified, user_id)
WHERE NOT EXISTS (
SELECT 1 FROM public.service_providers sp WHERE sp.name = v.name AND sp.address = v.address
);
-- 28. DUMMY VETERINARIANS
INSERT INTO public.vets (name, clinic_name, description, address, phone, emergency_number, email, specialization, is_verified, user_id)
SELECT v.name, v.clinic_name, v.description, v.address, v.phone, v.emergency_number, v.email, v.specialization, v.is_verified, v.user_id
FROM (VALUES
('Dr. Sarah Mkhize', 'Healthy Paws Clinic', 'Small animal and emergency veterinarian.', '22 Health Street, Cape Town', '0215559001', '0215559999', 'sarah@healthypaws.example.com', 'Small Animals', true, (SELECT user_id FROM public.users WHERE email = 'provider@example.com')),
('Dr. Ian van der Merwe', 'Urban Pet Health', 'Emergency and wellness veterinary services.', '88 City Veterinary Road, Johannesburg', '0115559003', '0115559998', 'ian@urbanpethealth.example.com', 'Emergency Care', true, (SELECT user_id FROM public.users WHERE email = 'manager@example.com'))
) AS v(name, clinic_name, description, address, phone, emergency_number, email, specialization, is_verified, user_id)
WHERE NOT EXISTS (
SELECT 1 FROM public.vets vt WHERE vt.name = v.name AND vt.clinic_name = v.clinic_name
);

-- 30. DUMMY EVENT CATEGORIES
INSERT INTO public.event_categories (name, description, icon, color) VALUES
('Adoption & Rescue', 'Events focused on adoption and animal rescue.', 'â¤ï¸', '#EF4444'),
('Health & Wellness', 'Vaccination clinics and wellness check events.', 'ðŸ©º', '#10B981'),
('Community Meetups', 'Community gatherings for animal lovers.', 'ðŸ¤', '#3B82F6')
ON CONFLICT (name) DO NOTHING;
-- 28. DUMMY RESCUE CENTRES
INSERT INTO public.rescue_centres (name, description, address, phone, website, is_verified)
SELECT v.name, v.description, v.address, v.phone, v.website, v.is_verified
FROM (VALUES
('SafePaws Rescue', 'Verified rescue centre for at-risk animals.', '34 Rescue Lane, Cape Town', '0215556789', 'https://safepaws.example.com', true),
('SecondChance Shelter', 'Monthly supported shelter and rescue campaigns.', '12 Shelter Road, Johannesburg', '0115551234', 'https://secondchance.example.com', false)
) AS v(name, description, address, phone, website, is_verified)
WHERE NOT EXISTS (
SELECT 1 FROM public.rescue_centres rc WHERE rc.name = v.name
);
-- 29. DUMMY BOOST PACKAGES
INSERT INTO public.boost_packages (name, description, duration_days, price, is_active)
SELECT v.name, v.description, v.duration_days, v.price, v.is_active
FROM (VALUES
('Visibility Booster', 'Featured placement for your listed place or group.', 30, 49.99, true),
('Premium Promotion', 'Higher priority promotion across search and listings.', 60, 99.99, true)
) AS v(name, description, duration_days, price, is_active)
WHERE NOT EXISTS (
SELECT 1 FROM public.boost_packages bp WHERE bp.name = v.name
);
-- 31. DUMMY SUPPORT & NOTIFICATIONS
INSERT INTO public.support_tickets (user_id, subject, initial_message, status, last_reply_at)
SELECT u.user_id, 'Need help with place listing', 'I need assistance updating my place details.', 'open', NOW()
FROM public.users u
WHERE u.email = 'subscriber@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.support_tickets st WHERE st.user_id = u.user_id AND st.subject = 'Need help with place listing'
);
INSERT INTO public.support_tickets (user_id, subject, initial_message, status)
SELECT u.user_id, 'Provider access issue', 'I need help linking my new provider profile.', 'pending'
FROM public.users u
WHERE u.email = 'provider@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.support_tickets st WHERE st.user_id = u.user_id AND st.subject = 'Provider access issue'
);
INSERT INTO public.notifications (title, body, target, level, send_at, status)
SELECT v.title, v.body, v.target, v.level, v.send_at, v.status
FROM (VALUES
('Welcome to Animal Click', 'Your account has been created and is ready to use.', 'all', 'info', NOW(), 'sent'),
('Event approval required', 'New event submissions await approval in the dashboard.', 'Admin', 'warning', NOW() + INTERVAL '1 hour', 'pending')
) AS v(title, body, target, level, send_at, status)
WHERE NOT EXISTS (
SELECT 1 FROM public.notifications n WHERE n.title = v.title AND n.body = v.body
);
-- 31. DUMMY AUDIT LOGS
INSERT INTO public.audit_logs (actor_user_id, action, resource, details)
SELECT u.user_id, 'seed.create', 'system', '{"note":"initial dummy data"}'
FROM public.users u
WHERE u.email = 'owner@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs al WHERE al.actor_user_id = u.user_id AND al.action = 'seed.create' AND al.resource = 'system'
);
-- 32. DUMMY PET FRIENDLY PLACES AND LINKING
INSERT INTO public.pet_friendly_places (name, description, address, phone, email, website, place_type, price_range, is_verified, user_id)
SELECT v.name, v.description, v.address, v.phone, v.email, v.website, v.place_type, v.price_range, v.is_verified, v.user_id
FROM (VALUES
('Happy Trails Boarding', 'Safe and spacious boarding for pets of all sizes.', '10 Park Street, Cape Town', '0215552323', 'hello@happytrails.example.com', 'https://happytrails.example.com', 'Boarding', '$$$', true, (SELECT user_id FROM public.users WHERE email = 'provider@example.com')),
('Bark & Purr Park', 'Large pet-friendly park with play areas and grooming service.', '75 Greenway Ave, Johannesburg', '0115554343', 'contact@barkpurr.example.com', 'https://barkpurr.example.com', 'Recreation', '$$', true, (SELECT user_id FROM public.users WHERE email = 'provider@example.com'))
) AS v(name, description, address, phone, email, website, place_type, price_range, is_verified, user_id)
WHERE NOT EXISTS (
SELECT 1 FROM public.pet_friendly_places p WHERE p.name = v.name
);
INSERT INTO public.place_groups (place_id, group_id)
SELECT p.pet_friendly_place_id, g.group_id
FROM public.pet_friendly_places p, public.groups g
WHERE p.name = 'Happy Trails Boarding' AND g.name = 'Pet Friendly Accommodation'
AND NOT EXISTS (
    SELECT 1 FROM public.place_groups pg WHERE pg.place_id = p.pet_friendly_place_id AND pg.group_id = g.group_id
);
INSERT INTO public.place_groups (place_id, group_id)
SELECT p.pet_friendly_place_id, g.group_id
FROM public.pet_friendly_places p, public.groups g
WHERE p.name = 'Bark & Purr Park' AND g.name = 'Pet Events & Training'
AND NOT EXISTS (
    SELECT 1 FROM public.place_groups pg WHERE pg.place_id = p.pet_friendly_place_id AND pg.group_id = g.group_id
);
INSERT INTO public.place_animal_types (place_id, animal_type_id)
SELECT p.pet_friendly_place_id, a.animal_type_id
FROM public.pet_friendly_places p, public.animal_types a
WHERE p.name = 'Happy Trails Boarding' AND a.name = 'Dogs'
AND NOT EXISTS (
    SELECT 1 FROM public.place_animal_types pa WHERE pa.place_id = p.pet_friendly_place_id AND pa.animal_type_id = a.animal_type_id
);
INSERT INTO public.place_animal_types (place_id, animal_type_id)
SELECT p.pet_friendly_place_id, a.animal_type_id
FROM public.pet_friendly_places p, public.animal_types a
WHERE p.name = 'Bark & Purr Park' AND a.name = 'Cats'
AND NOT EXISTS (
    SELECT 1 FROM public.place_animal_types pa WHERE pa.place_id = p.pet_friendly_place_id AND pa.animal_type_id = a.animal_type_id
);
-- 33. DUMMY EVENTS
INSERT INTO public.events (title, description, event_date, venue, location, expiry, is_active, is_approved, user_id, event_category_id)
SELECT 'Community Adoption Day', 'Join our community adoption event for rescued pets.', NOW() + INTERVAL '7 days', 'Bark & Purr Park', 'Johannesburg, South Africa', NOW() + INTERVAL '10 days', true, true, u.user_id, c.event_category_id
FROM public.users u, public.event_categories c
WHERE u.email = 'subscriber@example.com' AND c.name = 'Adoption & Rescue'
AND NOT EXISTS (
    SELECT 1 FROM public.events e WHERE e.title = 'Community Adoption Day'
);
INSERT INTO public.events (title, description, event_date, venue, location, expiry, is_active, is_approved, user_id, event_category_id)
SELECT 'Veterinary Wellness Clinic', 'Free wellness checks and vaccination reminders.', NOW() + INTERVAL '14 days', 'Happy Trails Boarding', 'Cape Town, South Africa', NOW() + INTERVAL '16 days', true, false, u.user_id, c.event_category_id
FROM public.users u, public.event_categories c
WHERE u.email = 'subscriber@example.com' AND c.name = 'Health & Wellness'
AND NOT EXISTS (
    SELECT 1 FROM public.events e WHERE e.title = 'Veterinary Wellness Clinic'
);
-- 34. DUMMY COMMUNITY POSTS
INSERT INTO public.community_posts (user_id, title, body, is_active)
SELECT u.user_id, 'New dog-friendly event', 'Excited to share a dog-friendly event this weekend.', true
FROM public.users u
WHERE u.email = 'subscriber@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.community_posts cp WHERE cp.user_id = u.user_id AND cp.title = 'New dog-friendly event'
);
-- 35. DUMMY REVIEWS
INSERT INTO public.reviews (user_id, place_id, rating, comment, is_approved)
SELECT u.user_id, p.pet_friendly_place_id, 5, 'Amazing boarding service and friendly staff.', true
FROM public.users u, public.pet_friendly_places p
WHERE u.email = 'subscriber@example.com' AND p.name = 'Happy Trails Boarding'
ON CONFLICT DO NOTHING;
-- 36. DUMMY PROVIDER REQUESTS
INSERT INTO public.provider_requests (user_id, place_id, status, notes)
SELECT u.user_id, p.pet_friendly_place_id, 'pending', 'Requesting provider access after verifying ownership.'
FROM public.users u, public.pet_friendly_places p
WHERE u.email = 'subscriber@example.com' AND p.name = 'Bark & Purr Park'
AND NOT EXISTS (
    SELECT 1 FROM public.provider_requests pr WHERE pr.user_id = u.user_id AND pr.place_id = p.pet_friendly_place_id AND pr.status = 'pending' AND pr.notes = 'Requesting provider access after verifying ownership.'
);
-- 37. DUMMY DONATION CAMPAIGNS
INSERT INTO public.donation_campaigns (rescue_centre_id, title, description, monthly_target, visible, expires_at)
SELECT rc.rescue_centre_id, 'Monthly Rescue Support', 'Help us fund rescue operations for vulnerable animals.', 2500.00, true, NOW() + INTERVAL '60 days'
FROM public.rescue_centres rc
WHERE rc.name = 'SafePaws Rescue'
AND NOT EXISTS (
    SELECT 1 FROM public.donation_campaigns dc WHERE dc.rescue_centre_id = rc.rescue_centre_id AND dc.title = 'Monthly Rescue Support'
);
-- 38. DUMMY BOOST PACKAGE LINKS
INSERT INTO public.boost_package_links (boost_package_id, place_id, group_id, expires_at)
SELECT bp.boost_package_id, p.pet_friendly_place_id, g.group_id, NOW() + INTERVAL '30 days'
FROM public.boost_packages bp, public.pet_friendly_places p, public.groups g
WHERE bp.name = 'Visibility Booster' AND p.name = 'Happy Trails Boarding' AND g.name = 'Pet Friendly Accommodation'
ON CONFLICT DO NOTHING;
-- 39. DUMMY ENTITY BOOSTS
INSERT INTO public.entity_boosts (user_id, boost_package_id, service_provider_id, start_date, end_date, is_active)
SELECT u.user_id, bp.boost_package_id, sp.service_provider_id, NOW(), NOW() + INTERVAL '30 days', true
FROM public.users u, public.boost_packages bp, public.service_providers sp
WHERE u.email = 'provider@example.com' AND bp.name = 'Premium Promotion'
AND NOT EXISTS (
    SELECT 1 FROM public.entity_boosts eb WHERE eb.user_id = u.user_id AND eb.boost_package_id = bp.boost_package_id AND eb.service_provider_id = sp.service_provider_id AND eb.is_active = true
)
LIMIT 1;
-- 39. DUMMY SAVED PLACES
INSERT INTO public.saved_places (user_id, place_id)
SELECT u.user_id, p.pet_friendly_place_id
FROM public.users u, public.pet_friendly_places p
WHERE u.email = 'subscriber@example.com' AND p.name = 'Happy Trails Boarding'
AND NOT EXISTS (
    SELECT 1 FROM public.saved_places sp WHERE sp.user_id = u.user_id AND sp.place_id = p.pet_friendly_place_id
);
-- 40. DUMMY SUPPORT REPLIES
INSERT INTO public.support_replies (support_ticket_id, reply, responder_user_id)
SELECT t.support_ticket_id, 'Thank you â€” we will review your request and respond shortly.', u.user_id
FROM public.support_tickets t, public.users u
WHERE t.subject = 'Need help with place listing' AND u.email = 'admin@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.support_replies sr WHERE sr.support_ticket_id = t.support_ticket_id AND sr.reply = 'Thank you â€” we will review your request and respond shortly.' AND sr.responder_user_id = u.user_id
);
-- 41. LINK DUMMY NOTIFICATIONS TO AUDIT LOGS
INSERT INTO public.audit_logs (actor_user_id, action, resource, details)
SELECT u.user_id, 'notification.create', 'notifications', jsonb_build_object('notification', n.title)
FROM public.users u, public.notifications n
WHERE u.email = 'admin@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs al WHERE al.actor_user_id = u.user_id AND al.action = 'notification.create' AND al.resource = 'notifications' AND al.details = jsonb_build_object('notification', n.title)
);
-- 42. DUMMY DATABASE COMPLETION NOTE
INSERT INTO public.audit_logs (actor_user_id, action, resource, details)
SELECT u.user_id, 'seed.complete', 'database', '{"note":"Core entity seed data inserted."}'
FROM public.users u
WHERE u.email = 'owner@example.com'
AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs al WHERE al.actor_user_id = u.user_id AND al.action = 'seed.complete' AND al.resource = 'database'
);



-- ============================================================
-- Migration: 007_create_animal_types_and_breeds_tables.sql
-- ============================================================

-- Create animal_types and breeds tables
create table if not exists public.animal_types (
  animal_type_id bigint generated always as identity not null,
  name text not null,
  image_url text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint animal_types_pkey primary key (animal_type_id)
) tablespace pg_default;

create table if not exists public.breeds (
  breed_id bigint generated always as identity not null,
  name text not null,
  description text null,
  image_url text null,
  animal_type_id bigint null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint breeds_pkey primary key (breed_id),
  constraint breeds_animal_type_id_fkey foreign key (animal_type_id) references public.animal_types(animal_type_id)
) tablespace pg_default;

create index if not exists idx_animal_types_name on public.animal_types (name);
create index if not exists idx_breeds_name on public.breeds (name);
create index if not exists idx_breeds_animal_type_id on public.breeds (animal_type_id);



-- ============================================================
-- Migration: 008_create_breeder_breeds_and_pet_friendly_place_animals_tables.sql
-- ============================================================

-- Create breeder_breeds and pet_friendly_place_animals tables
create table if not exists public.breeder_breeds (
  breeder_breed_id bigint generated always as identity not null,
  breeder_id bigint not null,
  breed_id bigint not null,
  service_provider_id bigint null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint breeder_breeds_pkey primary key (breeder_breed_id),
  constraint breeder_breeds_breed_id_fkey foreign key (breed_id) references public.breeds(breed_id),
  constraint breeder_breeds_service_provider_id_fkey foreign key (service_provider_id) references public.service_providers(service_provider_id)
) tablespace pg_default;

create index if not exists idx_breeder_breeds_breeder_id on public.breeder_breeds (breeder_id);
create index if not exists idx_breeder_breeds_breed_id on public.breeder_breeds (breed_id);
create index if not exists idx_breeder_breeds_service_provider_id on public.breeder_breeds (service_provider_id);

create table if not exists public.pet_friendly_place_animals (
  pet_friendly_place_animal_id bigint generated always as identity not null,
  pet_friendly_place_id bigint not null,
  animal_type_id bigint not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint pet_friendly_place_animals_pkey primary key (pet_friendly_place_animal_id),
  constraint pet_friendly_place_animals_pet_friendly_place_id_fkey foreign key (pet_friendly_place_id) references public.pet_friendly_places(pet_friendly_place_id),
  constraint pet_friendly_place_animals_animal_type_id_fkey foreign key (animal_type_id) references public.animal_types(animal_type_id)
) tablespace pg_default;

create index if not exists idx_pet_friendly_place_animals_place_id on public.pet_friendly_place_animals (pet_friendly_place_id);
create index if not exists idx_pet_friendly_place_animals_animal_type_id on public.pet_friendly_place_animals (animal_type_id);



-- ============================================================
-- Migration: 009_add_image_url_to_animal_types.sql
-- ============================================================

-- Add image support to animal_types for the CRUD form and preview UI
ALTER TABLE public.animal_types
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.animal_types
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();


-- ============================================================
-- Migration: 009_create_locations_and_service_provider_location_relation.sql
-- ============================================================

-- Create locations table and add location_id to service_providers
create table if not exists public.locations (
  location_id bigint generated always as identity not null,
  address text not null,
  latitude text null,
  longitude text null,
  show_publicly boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint locations_pkey primary key (location_id)
) tablespace pg_default;

alter table public.service_providers
  add column if not exists location_id bigint null;

-- Add foreign key constraint if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_providers_location_id_fkey'
  ) then
    alter table public.service_providers
      add constraint service_providers_location_id_fkey
      foreign key (location_id)
      references public.locations(location_id);
  end if;
end$$;

create index if not exists idx_locations_address on public.locations (address);
create index if not exists idx_service_providers_location_id on public.service_providers (location_id);



-- ============================================================
-- Migration: 010_add_service_category_to_service_providers.sql
-- ============================================================

-- Add service_category_id to service_providers and create the foreign key relationship
alter table public.service_providers
  add column if not exists service_category_id bigint null;

-- Add foreign key constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_providers_service_category_id_fkey'
  ) THEN
    ALTER TABLE public.service_providers
      ADD CONSTRAINT service_providers_service_category_id_fkey
      FOREIGN KEY (service_category_id)
      REFERENCES public.service_categories(service_category_id);
  END IF;
END$$;

create index if not exists idx_service_providers_service_category_id on public.service_providers (service_category_id);
-- Add is_deleted column to service_providers for soft-delete support
alter table public.service_providers
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_service_providers_is_deleted on public.service_providers (is_deleted);



-- ============================================================
-- Migration: 011_create_event_categories_table.sql
-- ============================================================

-- Create event_categories table
create table if not exists public.event_categories (
  event_category_id bigint generated always as identity not null,
  name text not null,
  description text null,
  icon text null,
  color text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint event_categories_pkey primary key (event_category_id)
) tablespace pg_default;

create index if not exists idx_event_categories_name on public.event_categories (name);



-- ============================================================
-- Migration: 012_create_events_table.sql
-- ============================================================

-- Create events table
create table if not exists public.events (
  event_id bigint generated always as identity not null,
  service_provider_id bigint null,
  title text not null,
  description text null,
  event_date timestamp with time zone not null,
  end_date timestamp with time zone null,
  location_id bigint null,
  image_url text null,
  price numeric(10,2) null,
  max_attendees integer null,
  current_attendees integer not null default 0,
  is_active boolean not null default true,
  event_category_id bigint null,
  additional_info jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint events_pkey primary key (event_id)
) tablespace pg_default;

-- Ensure columns exist if events table was created by migration 007
alter table public.events add column if not exists end_date timestamp with time zone null;
alter table public.events add column if not exists location_id bigint null;
alter table public.events add column if not exists image_url text null;
alter table public.events add column if not exists price numeric(10,2) null;
alter table public.events add column if not exists max_attendees integer null;
alter table public.events add column if not exists current_attendees integer not null default 0;
alter table public.events add column if not exists additional_info jsonb null;

alter table public.events drop constraint if exists events_service_provider_id_fkey;
alter table public.events
  add constraint events_service_provider_id_fkey foreign key (service_provider_id) references public.service_providers(service_provider_id);

alter table public.events drop constraint if exists events_location_id_fkey;
alter table public.events
  add constraint events_location_id_fkey foreign key (location_id) references public.locations(location_id);

alter table public.events drop constraint if exists events_event_category_id_fkey;
alter table public.events
  add constraint events_event_category_id_fkey foreign key (event_category_id) references public.event_categories(event_category_id);

create index if not exists idx_events_service_provider_id on public.events (service_provider_id);
create index if not exists idx_events_location_id on public.events (location_id);
create index if not exists idx_events_event_category_id on public.events (event_category_id);
create index if not exists idx_events_event_date on public.events (event_date);



-- ============================================================
-- Migration: 013_add_is_verified_is_deleted_to_users_table.sql
-- ============================================================

-- Add is_verified and is_deleted columns to users table
alter table public.users
  add column if not exists is_verified boolean not null default false;

alter table public.users
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_users_is_deleted on public.users (is_deleted);
create index if not exists idx_users_is_verified on public.users (is_verified);



-- ============================================================
-- Migration: 014_create_transactions_table.sql
-- ============================================================

-- Create transactions table
create table if not exists public.transactions (
  transaction_id bigint generated always as identity not null,
  user_id bigint not null,
  amount numeric(10,2) not null,
  status text not null,
  payment_reference text not null,
  object jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint transactions_pkey primary key (transaction_id)
) tablespace pg_default;

alter table public.transactions drop constraint if exists transactions_user_id_fkey;
alter table public.transactions
  add constraint transactions_user_id_fkey foreign key (user_id) references public.users(user_id);

create index if not exists idx_transactions_user_id on public.transactions (user_id);
create index if not exists idx_transactions_status on public.transactions (status);
create index if not exists idx_transactions_created_at on public.transactions (created_at);



-- ============================================================
-- Migration: 015_ensure_image_url_on_animal_types.sql
-- ============================================================

-- Ensure animal_types has image_url for uploaded image links
ALTER TABLE public.animal_types
ADD COLUMN IF NOT EXISTS image_url TEXT;



-- ============================================================
-- Migration: 016_create_animalclickposts_bucket.sql
-- ============================================================

-- Ensure the shared image bucket exists for image uploads and previews.
insert into storage.buckets (id, name, public)
values ('animalclickposts', 'animalclickposts', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;


-- ============================================================
-- Migration: 017_create_breeds_table.sql
-- ============================================================

-- Ensure the breeds table exists for breed CRUD, filtering, and animal-type joins.
CREATE TABLE IF NOT EXISTS public.breeds (
  breed_id BIGINT GENERATED ALWAYS AS IDENTITY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  image_url TEXT NULL,
  animal_type_id BIGINT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
  CONSTRAINT breeds_pkey PRIMARY KEY (breed_id),
  CONSTRAINT breeds_animal_type_id_fkey
    FOREIGN KEY (animal_type_id)
    REFERENCES public.animal_types(animal_type_id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_breeds_name ON public.breeds (name);
CREATE INDEX IF NOT EXISTS idx_breeds_animal_type_id ON public.breeds (animal_type_id);


-- ============================================================
-- Migration: 018_add_current_token_hashes_to_users_table.sql
-- ============================================================

-- Add current access and refresh token hashes to users table for strict session invalidation
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_access_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS current_refresh_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_users_current_access_token_hash ON public.users (current_access_token_hash);
CREATE INDEX IF NOT EXISTS idx_users_current_refresh_token_hash ON public.users (current_refresh_token_hash);



-- ============================================================
-- Migration: 019_add_community_comments_table.sql
-- ============================================================

-- Add community comments table for post comment counts
CREATE TABLE IF NOT EXISTS public.community_comments (
  comment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id BIGINT REFERENCES public.community_posts(post_id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON public.community_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_community_comments_user_id ON public.community_comments(user_id);



-- ============================================================
-- Migration: 020_add_post_likes_reaction_type.sql
-- ============================================================

-- Add reaction type to community post likes so likes and dislikes are supported
ALTER TABLE public.post_likes
  ADD COLUMN IF NOT EXISTS reaction TEXT NOT NULL DEFAULT 'like';

CREATE INDEX IF NOT EXISTS idx_post_likes_reaction ON public.post_likes(reaction);



-- ============================================================
-- Migration: 021_add_image_url_to_community_posts.sql
-- ============================================================

-- Add image_url column to community_posts for post images
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;



-- ============================================================
-- Migration: 022_add_locations_rls_policies.sql
-- ============================================================

-- Ensure locations table exists (in case migration 009 wasn't run)
create table if not exists public.locations (
  location_id bigint generated always as identity not null,
  address text not null,
  latitude text null,
  longitude text null,
  show_publicly boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint locations_pkey primary key (location_id)
) tablespace pg_default;

-- Enable RLS on locations table
alter table public.locations enable row level security;

-- Allow authenticated users to select all locations
drop policy if exists "Authenticated users can select locations" on public.locations;
create policy "Authenticated users can select locations"
  on public.locations
  for select
  to authenticated
  using (true);

-- Allow anon users to select publicly visible locations
drop policy if exists "Anon users can select public locations" on public.locations;
create policy "Anon users can select public locations"
  on public.locations
  for select
  to anon
  using (show_publicly = true);

-- Allow authenticated users to insert locations
drop policy if exists "Authenticated users can insert locations" on public.locations;
create policy "Authenticated users can insert locations"
  on public.locations
  for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update locations
drop policy if exists "Authenticated users can update locations" on public.locations;
create policy "Authenticated users can update locations"
  on public.locations
  for update
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users to delete locations
drop policy if exists "Authenticated users can delete locations" on public.locations;
create policy "Authenticated users can delete locations"
  on public.locations
  for delete
  to authenticated
  using (true);



-- ============================================================
-- Migration: 023_add_missing_service_provider_columns.sql
-- ============================================================

-- Add missing columns to service_providers table
alter table public.service_providers
  add column if not exists bio text null,
  add column if not exists image_url text null,
  add column if not exists emergency_number text null,
  add column if not exists number_2 text null,
  add column if not exists rating integer not null default 0,
  add column if not exists total_reviews integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists operating_hours jsonb null;

-- Drop the old address column if it exists (now using locations table)
alter table public.service_providers
  drop column if exists address;

-- Drop the old service_type column if it exists (now using service_categories)
alter table public.service_providers
  drop column if exists service_type;

-- Drop the old user_id column if it exists (using auth users now)
alter table public.service_providers
  drop column if exists user_id;



-- ============================================================
-- Migration: 024_fix_service_providers_complete.sql
-- ============================================================

-- =============================
-- Add all missing columns to service_providers
-- =============================

alter table public.service_providers
  add column if not exists bio text null,
  add column if not exists image_url text null,
  add column if not exists emergency_number text null,
  add column if not exists number_2 text null,
  add column if not exists rating integer not null default 0,
  add column if not exists total_reviews integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists operating_hours jsonb null,
  add column if not exists location_id bigint null,
  add column if not exists service_category_id bigint null,
  add column if not exists is_deleted boolean not null default false;

-- =============================
-- Create services table if not exists
-- =============================
create table if not exists public.services (
  service_id bigint generated always as identity not null,
  service_provider_id bigint not null references public.service_providers(service_provider_id) on delete cascade,
  name text not null,
  description text null,
  price numeric(10,2) null,
  duration_minutes integer null,
  is_active boolean not null default true,
  additional_info jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint services_pkey primary key (service_id)
) tablespace pg_default;

create index if not exists idx_services_service_provider_id on public.services (service_provider_id);

-- =============================
-- Create service_provider_images table if not exists
-- =============================
create table if not exists public.service_provider_images (
  service_provider_image bigint generated always as identity not null,
  service_provider_id bigint not null references public.service_providers(service_provider_id) on delete cascade,
  image_url text not null,
  "order" integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint service_provider_images_pkey primary key (service_provider_image)
) tablespace pg_default;

create index if not exists idx_service_provider_images_service_provider_id on public.service_provider_images (service_provider_id);

-- =============================
-- Enable RLS on services and service_provider_images
-- =============================
alter table public.services enable row level security;
alter table public.service_provider_images enable row level security;

drop policy if exists "Authenticated users can select services" on public.services;
create policy "Authenticated users can select services"
  on public.services for select to authenticated using (true);

drop policy if exists "Authenticated users can insert services" on public.services;
create policy "Authenticated users can insert services"
  on public.services for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update services" on public.services;
create policy "Authenticated users can update services"
  on public.services for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete services" on public.services;
create policy "Authenticated users can delete services"
  on public.services for delete to authenticated using (true);

drop policy if exists "Authenticated users can select service_provider_images" on public.service_provider_images;
create policy "Authenticated users can select service_provider_images"
  on public.service_provider_images for select to authenticated using (true);

drop policy if exists "Authenticated users can insert service_provider_images" on public.service_provider_images;
create policy "Authenticated users can insert service_provider_images"
  on public.service_provider_images for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update service_provider_images" on public.service_provider_images;
create policy "Authenticated users can update service_provider_images"
  on public.service_provider_images for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete service_provider_images" on public.service_provider_images;
create policy "Authenticated users can delete service_provider_images"
  on public.service_provider_images for delete to authenticated using (true);



-- ============================================================
-- Migration: 025_fix_breeder_breeds_and_location_fk.sql
-- ============================================================

-- =============================
-- Create service_provider_breeds table (replaces breeder_breeds)
-- Direct relationship between service_providers and breeds
-- =============================

create table if not exists public.service_provider_breeds (
  id bigint generated always as identity not null,
  service_provider_id bigint not null references public.service_providers(service_provider_id) on delete cascade,
  breed_id bigint not null references public.breeds(breed_id),
  created_at timestamp with time zone not null default now(),
  constraint service_provider_breeds_pkey primary key (id),
  constraint service_provider_breeds_unique unique (service_provider_id, breed_id)
) tablespace pg_default;

create index if not exists idx_sp_breeds_service_provider_id on public.service_provider_breeds (service_provider_id);
create index if not exists idx_sp_breeds_breed_id on public.service_provider_breeds (breed_id);

-- Drop old breeder_breeds table if it exists
drop table if exists public.breeder_breeds;

-- =============================
-- Add FK constraint: service_providers.location_id -> locations.location_id
-- =============================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_providers_location_id_fkey'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'locations'
  ) then
    alter table public.service_providers
      add constraint service_providers_location_id_fkey
      foreign key (location_id)
      references public.locations(location_id);
  end if;
end$$;

-- =============================
-- Add FK constraint: service_providers.service_category_id -> service_categories
-- =============================
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_providers_service_category_id_fkey'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'service_categories'
  ) then
    alter table public.service_providers
      add constraint service_providers_service_category_id_fkey
      foreign key (service_category_id)
      references public.service_categories(service_category_id);
  end if;
end$$;

-- Ensure is_deleted column exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'service_providers' and column_name = 'is_deleted'
  ) then
    alter table public.service_providers add column is_deleted boolean not null default false;
  end if;
end$$;

-- =============================
-- Ensure breeds table exists (referenced by breeder_breeds FK)
-- =============================
create table if not exists public.breeds (
  breed_id bigint generated always as identity not null,
  animal_type_id bigint null,
  name text not null,
  description text null,
  is_active boolean null default true,
  created_at timestamp with time zone not null default now(),
  constraint breeds_pkey primary key (breed_id)
) tablespace pg_default;



-- ============================================================
-- Migration: 026_ensure_service_providers_complete_schema.sql
-- ============================================================

-- =============================
-- Ensure service_providers table has all required columns
-- =============================

-- Add all columns that might be missing
alter table public.service_providers
  add column if not exists bio text null,
  add column if not exists image_url text null,
  add column if not exists emergency_number text null,
  add column if not exists number_2 text null,
  add column if not exists rating integer not null default 0,
  add column if not exists total_reviews integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists featured boolean not null default false,
  add column if not exists operating_hours jsonb null,
  add column if not exists location_id bigint null,
  add column if not exists service_category_id bigint null,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists views integer not null default 0;

-- Enable RLS
alter table public.service_providers enable row level security;

-- Drop existing policies to recreate
drop policy if exists "Authenticated users can select service_providers" on public.service_providers;
drop policy if exists "Authenticated users can insert service_providers" on public.service_providers;
drop policy if exists "Authenticated users can update service_providers" on public.service_providers;
drop policy if exists "Authenticated users can delete service_providers" on public.service_providers;

-- Create RLS policies
create policy "Authenticated users can select service_providers"
  on public.service_providers for select to authenticated using (true);

create policy "Authenticated users can insert service_providers"
  on public.service_providers for insert to authenticated with check (true);

create policy "Authenticated users can update service_providers"
  on public.service_providers for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete service_providers"
  on public.service_providers for delete to authenticated using (true);

-- Allow public/anonymous read access (for public listing)
drop policy if exists "Public can select service_providers" on public.service_providers;
create policy "Public can select service_providers"
  on public.service_providers for select to anon using (true);



-- ============================================================
-- Migration: 027_add_image_url_to_events.sql
-- ============================================================

-- Add image_url column to events for uploaded event images
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS image_url TEXT;



-- ============================================================
-- Migration: 028_add_missing_events_columns.sql
-- ============================================================

-- Add columns to events table that were defined in migration 012
-- but not applied because migration 007 already created the table

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_id BIGINT;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS max_attendees INTEGER;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS current_attendees INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS additional_info JSONB;

-- Foreign key for location_id (safe to add only if column was just added)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'location_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'events' AND ccu.column_name = 'location_id'
    ) THEN
      ALTER TABLE public.events
        ADD CONSTRAINT events_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES public.locations(location_id);
    END IF;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_location_id ON public.events (location_id);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON public.events (end_date);



-- ============================================================
-- Migration: 029_add_missing_pet_friendly_places_columns.sql
-- ============================================================

-- Add missing columns to pet_friendly_places table
alter table public.pet_friendly_places
  add column if not exists image_url text null,
  add column if not exists location_id bigint null references public.locations(location_id) on delete set null,
  add column if not exists rating integer not null default 0,
  add column if not exists views integer not null default 0,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists operating_hours jsonb null,
  add column if not exists amenities jsonb null,
  add column if not exists pet_policy text null;

-- Rename place_id to pet_friendly_place_id if old column name still exists
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pet_friendly_places' and column_name = 'place_id'
  ) then
    alter table public.pet_friendly_places rename column place_id to pet_friendly_place_id;
  end if;
end $$;

-- Add index on location_id for faster joins
create index if not exists idx_pet_friendly_places_location_id on public.pet_friendly_places(location_id);

-- Add index on is_deleted for filtering
create index if not exists idx_pet_friendly_places_is_deleted on public.pet_friendly_places(is_deleted);



-- ============================================================
-- Migration: 030_remove_animal_types_from_pet_friendly_places.sql
-- ============================================================

-- Drop pet_friendly_place_animals pivot table
drop table if exists public.pet_friendly_place_animals;

-- Drop place_animal_types pivot table
drop table if exists public.place_animal_types;



-- ============================================================
-- Migration: 031_create_whats_new_table.sql
-- ============================================================

-- Create whats_new table
CREATE TABLE IF NOT EXISTS public.whats_new (
    whats_new_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create permissions
INSERT INTO public.permissions (name, description, resource, action)
VALUES
    ('whats_new.view', 'View what''s new entries', 'whats_new', 'read'),
    ('whats_new.create', 'Create what''s new entries', 'whats_new', 'create'),
    ('whats_new.update', 'Update what''s new entries', 'whats_new', 'update'),
    ('whats_new.delete', 'Delete what''s new entries', 'whats_new', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to Owner role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Owner'
  AND p.resource = 'whats_new'
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whats_new_created_by
    ON public.whats_new(created_by);

CREATE INDEX IF NOT EXISTS idx_whats_new_is_active
    ON public.whats_new(is_active);

CREATE INDEX IF NOT EXISTS idx_whats_new_created_at
    ON public.whats_new(created_at);


-- ============================================================
-- Migration: 032_add_lat_lng_to_rescue_centres.sql
-- ============================================================

-- Add latitude and longitude columns to rescue_centres
ALTER TABLE public.rescue_centres
ADD COLUMN IF NOT EXISTS latitude FLOAT NULL,
ADD COLUMN IF NOT EXISTS longitude FLOAT NULL;



-- ============================================================
-- Migration: 033_add_support_ticket_priority_and_assigned_to.sql
-- ============================================================

-- Add priority, assigned_to, and image_url columns to support_tickets table

ALTER TABLE IF EXISTS public.support_tickets
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS assigned_to BIGINT REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add image_url column to support_replies table
ALTER TABLE IF EXISTS public.support_replies
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add index for assigned_to for faster queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);



-- ============================================================
-- Migration: 034_add_support_ticket_permissions.sql
-- ============================================================

-- =============================
-- MIGRATION 34: SUPPORT TICKET PERMISSIONS
-- Ensures support ticket permissions are assigned to the correct roles
-- =============================

-- Ensure support permissions exist
INSERT INTO permissions (name, description, resource, action) VALUES
('support.view', 'View support tickets', 'support', 'read'),
('support.create', 'Create support tickets', 'support', 'create'),
('support.update', 'Update support tickets', 'support', 'update'),
('support.respond', 'Respond to support tickets', 'support', 'respond')
ON CONFLICT (name) DO NOTHING;

-- Owner: all support permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Owner'
  AND p.name IN ('support.view', 'support.create', 'support.update', 'support.respond')
ON CONFLICT DO NOTHING;

-- Admin: all support permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Admin'
  AND p.name IN ('support.view', 'support.create', 'support.update', 'support.respond')
ON CONFLICT DO NOTHING;

-- Manager: view, update, and respond to support tickets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Manager'
  AND p.name IN ('support.view', 'support.update', 'support.respond')
ON CONFLICT DO NOTHING;

-- Approver: view and respond to support tickets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Approver'
  AND p.name IN ('support.view', 'support.respond')
ON CONFLICT DO NOTHING;

-- Subscriber: view and create support tickets
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Subscriber'
  AND p.name IN ('support.view', 'support.create')
ON CONFLICT DO NOTHING;

-- Guest: create support tickets only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'Guest'
  AND p.name = 'support.create'
ON CONFLICT DO NOTHING;



-- ============================================================
-- Migration: 035_fix_rls_policies.sql
-- ============================================================

-- =============================
-- MIGRATION 035: FIX RLS POLICIES FOR ALL TABLES AND STORAGE
-- Resolves "new row violates row-level security policy" errors
-- during image uploads and other client-side operations.
-- =============================

-- =============================
-- PART 1: STORAGE BUCKET POLICIES
-- Ensures the animalclickposts bucket has proper RLS policies
-- so client-side uploads/deletes (using anon key) work.
-- =============================

-- Ensure the bucket exists
insert into storage.buckets (id, name, public)
values ('animalclickposts', 'animalclickposts', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- Allow public/anonymous users to view files
drop policy if exists "Public can view files" on storage.objects;
create policy "Public can view files"
  on storage.objects for select
  to anon
  using (bucket_id = 'animalclickposts');

-- Allow authenticated users to view files
drop policy if exists "Authenticated users can view files" on storage.objects;
create policy "Authenticated users can view files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'animalclickposts');

-- Allow authenticated users to upload files
drop policy if exists "Authenticated users can upload files" on storage.objects;
create policy "Authenticated users can upload files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'animalclickposts');

-- Allow authenticated users to update files
drop policy if exists "Authenticated users can update files" on storage.objects;
create policy "Authenticated users can update files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'animalclickposts')
  with check (bucket_id = 'animalclickposts');

-- Allow authenticated users to delete files
drop policy if exists "Authenticated users can delete files" on storage.objects;
create policy "Authenticated users can delete files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'animalclickposts');


-- =============================
-- PART 2: VENDORS TABLE (CREATED MANUALLY, NOT IN EARLIER MIGRATIONS)
-- =============================

create table if not exists public.vendors (
  vendor_id bigint generated always as identity not null,
  name text not null,
  email text null,
  phone text null,
  vendor_image_url text null,
  view_count integer not null default 0,
  average_vendor_rating numeric(3,2) not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint vendors_pkey primary key (vendor_id)
) tablespace pg_default;

alter table public.vendors enable row level security;

drop policy if exists "Public can select vendors" on public.vendors;
create policy "Public can select vendors"
  on public.vendors for select
  to anon
  using (true);

drop policy if exists "Authenticated users can select vendors" on public.vendors;
create policy "Authenticated users can select vendors"
  on public.vendors for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert vendors" on public.vendors;
create policy "Authenticated users can insert vendors"
  on public.vendors for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update vendors" on public.vendors;
create policy "Authenticated users can update vendors"
  on public.vendors for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete vendors" on public.vendors;
create policy "Authenticated users can delete vendors"
  on public.vendors for delete
  to authenticated
  using (true);

create index if not exists idx_vendors_name on public.vendors (name);


-- =============================
-- PART 3: VENDOR LOCATIONS TABLE (CREATED MANUALLY)
-- =============================

create table if not exists public.vendor_locations (
  vendor_location_id bigint generated always as identity not null,
  vendor_id bigint not null references public.vendors(vendor_id) on delete cascade,
  name text not null,
  online_only boolean not null default false,
  address text null,
  latitude numeric(10,7) null,
  longitude numeric(10,7) null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone null default now(),
  constraint vendor_locations_pkey primary key (vendor_location_id)
) tablespace pg_default;

alter table public.vendor_locations enable row level security;

drop policy if exists "Public can select vendor_locations" on public.vendor_locations;
create policy "Public can select vendor_locations"
  on public.vendor_locations for select
  to anon
  using (true);

drop policy if exists "Authenticated users can select vendor_locations" on public.vendor_locations;
create policy "Authenticated users can select vendor_locations"
  on public.vendor_locations for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert vendor_locations" on public.vendor_locations;
create policy "Authenticated users can insert vendor_locations"
  on public.vendor_locations for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update vendor_locations" on public.vendor_locations;
create policy "Authenticated users can update vendor_locations"
  on public.vendor_locations for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete vendor_locations" on public.vendor_locations;
create policy "Authenticated users can delete vendor_locations"
  on public.vendor_locations for delete
  to authenticated
  using (true);

create index if not exists idx_vendor_locations_vendor_id on public.vendor_locations (vendor_id);


-- =============================
-- PART 4: ENABLE RLS AND ADD POLICIES FOR ALL TABLES
-- Uses pattern: authenticated CRUD, anon SELECT (public read)
-- =============================

-- Helper function to create standard policies for any table
do $$ begin
  perform 1;
end $$;

-- =============================
-- 4.1: permissions
-- =============================
alter table public.permissions enable row level security;

drop policy if exists "Public can select permissions" on public.permissions;
create policy "Public can select permissions"
  on public.permissions for select to anon using (true);

drop policy if exists "Authenticated users can select permissions" on public.permissions;
create policy "Authenticated users can select permissions"
  on public.permissions for select to authenticated using (true);

drop policy if exists "Authenticated users can insert permissions" on public.permissions;
create policy "Authenticated users can insert permissions"
  on public.permissions for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update permissions" on public.permissions;
create policy "Authenticated users can update permissions"
  on public.permissions for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete permissions" on public.permissions;
create policy "Authenticated users can delete permissions"
  on public.permissions for delete to authenticated using (true);


-- =============================
-- 4.2: roles
-- =============================
alter table public.roles enable row level security;

drop policy if exists "Public can select roles" on public.roles;
create policy "Public can select roles"
  on public.roles for select to anon using (true);

drop policy if exists "Authenticated users can select roles" on public.roles;
create policy "Authenticated users can select roles"
  on public.roles for select to authenticated using (true);

drop policy if exists "Authenticated users can insert roles" on public.roles;
create policy "Authenticated users can insert roles"
  on public.roles for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update roles" on public.roles;
create policy "Authenticated users can update roles"
  on public.roles for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete roles" on public.roles;
create policy "Authenticated users can delete roles"
  on public.roles for delete to authenticated using (true);


-- =============================
-- 4.3: role_permissions
-- =============================
alter table public.role_permissions enable row level security;

drop policy if exists "Public can select role_permissions" on public.role_permissions;
create policy "Public can select role_permissions"
  on public.role_permissions for select to anon using (true);

drop policy if exists "Authenticated users can select role_permissions" on public.role_permissions;
create policy "Authenticated users can select role_permissions"
  on public.role_permissions for select to authenticated using (true);

drop policy if exists "Authenticated users can insert role_permissions" on public.role_permissions;
create policy "Authenticated users can insert role_permissions"
  on public.role_permissions for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update role_permissions" on public.role_permissions;
create policy "Authenticated users can update role_permissions"
  on public.role_permissions for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete role_permissions" on public.role_permissions;
create policy "Authenticated users can delete role_permissions"
  on public.role_permissions for delete to authenticated using (true);


-- =============================
-- 4.4: users
-- =============================
alter table public.users enable row level security;

drop policy if exists "Public can select users" on public.users;
create policy "Public can select users"
  on public.users for select to anon using (true);

drop policy if exists "Authenticated users can select users" on public.users;
create policy "Authenticated users can select users"
  on public.users for select to authenticated using (true);

drop policy if exists "Authenticated users can insert users" on public.users;
create policy "Authenticated users can insert users"
  on public.users for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update users" on public.users;
create policy "Authenticated users can update users"
  on public.users for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete users" on public.users;
create policy "Authenticated users can delete users"
  on public.users for delete to authenticated using (true);


-- =============================
-- 4.5: user_roles
-- =============================
alter table public.user_roles enable row level security;

drop policy if exists "Public can select user_roles" on public.user_roles;
create policy "Public can select user_roles"
  on public.user_roles for select to anon using (true);

drop policy if exists "Authenticated users can select user_roles" on public.user_roles;
create policy "Authenticated users can select user_roles"
  on public.user_roles for select to authenticated using (true);

drop policy if exists "Authenticated users can insert user_roles" on public.user_roles;
create policy "Authenticated users can insert user_roles"
  on public.user_roles for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update user_roles" on public.user_roles;
create policy "Authenticated users can update user_roles"
  on public.user_roles for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete user_roles" on public.user_roles;
create policy "Authenticated users can delete user_roles"
  on public.user_roles for delete to authenticated using (true);


-- =============================
-- 4.7: vets
-- =============================
alter table public.vets enable row level security;

drop policy if exists "Public can select vets" on public.vets;
create policy "Public can select vets"
  on public.vets for select to anon using (true);

drop policy if exists "Authenticated users can select vets" on public.vets;
create policy "Authenticated users can select vets"
  on public.vets for select to authenticated using (true);

drop policy if exists "Authenticated users can insert vets" on public.vets;
create policy "Authenticated users can insert vets"
  on public.vets for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update vets" on public.vets;
create policy "Authenticated users can update vets"
  on public.vets for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete vets" on public.vets;
create policy "Authenticated users can delete vets"
  on public.vets for delete to authenticated using (true);


-- =============================
-- 4.8: pet_friendly_places
-- =============================
alter table public.pet_friendly_places enable row level security;

drop policy if exists "Public can select pet_friendly_places" on public.pet_friendly_places;
create policy "Public can select pet_friendly_places"
  on public.pet_friendly_places for select to anon using (true);

drop policy if exists "Authenticated users can select pet_friendly_places" on public.pet_friendly_places;
create policy "Authenticated users can select pet_friendly_places"
  on public.pet_friendly_places for select to authenticated using (true);

drop policy if exists "Authenticated users can insert pet_friendly_places" on public.pet_friendly_places;
create policy "Authenticated users can insert pet_friendly_places"
  on public.pet_friendly_places for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update pet_friendly_places" on public.pet_friendly_places;
create policy "Authenticated users can update pet_friendly_places"
  on public.pet_friendly_places for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete pet_friendly_places" on public.pet_friendly_places;
create policy "Authenticated users can delete pet_friendly_places"
  on public.pet_friendly_places for delete to authenticated using (true);


-- =============================
-- 4.9: service_categories
-- =============================
alter table public.service_categories enable row level security;

drop policy if exists "Public can select service_categories" on public.service_categories;
create policy "Public can select service_categories"
  on public.service_categories for select to anon using (true);

drop policy if exists "Authenticated users can select service_categories" on public.service_categories;
create policy "Authenticated users can select service_categories"
  on public.service_categories for select to authenticated using (true);

drop policy if exists "Authenticated users can insert service_categories" on public.service_categories;
create policy "Authenticated users can insert service_categories"
  on public.service_categories for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update service_categories" on public.service_categories;
create policy "Authenticated users can update service_categories"
  on public.service_categories for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete service_categories" on public.service_categories;
create policy "Authenticated users can delete service_categories"
  on public.service_categories for delete to authenticated using (true);


-- =============================
-- 4.10: boost_packages
-- =============================
alter table public.boost_packages enable row level security;

drop policy if exists "Public can select boost_packages" on public.boost_packages;
create policy "Public can select boost_packages"
  on public.boost_packages for select to anon using (true);

drop policy if exists "Authenticated users can select boost_packages" on public.boost_packages;
create policy "Authenticated users can select boost_packages"
  on public.boost_packages for select to authenticated using (true);

drop policy if exists "Authenticated users can insert boost_packages" on public.boost_packages;
create policy "Authenticated users can insert boost_packages"
  on public.boost_packages for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update boost_packages" on public.boost_packages;
create policy "Authenticated users can update boost_packages"
  on public.boost_packages for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete boost_packages" on public.boost_packages;
create policy "Authenticated users can delete boost_packages"
  on public.boost_packages for delete to authenticated using (true);


-- =============================
-- 4.11: entity_boosts
-- =============================
alter table public.entity_boosts enable row level security;

drop policy if exists "Public can select entity_boosts" on public.entity_boosts;
create policy "Public can select entity_boosts"
  on public.entity_boosts for select to anon using (true);

drop policy if exists "Authenticated users can select entity_boosts" on public.entity_boosts;
create policy "Authenticated users can select entity_boosts"
  on public.entity_boosts for select to authenticated using (true);

drop policy if exists "Authenticated users can insert entity_boosts" on public.entity_boosts;
create policy "Authenticated users can insert entity_boosts"
  on public.entity_boosts for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update entity_boosts" on public.entity_boosts;
create policy "Authenticated users can update entity_boosts"
  on public.entity_boosts for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete entity_boosts" on public.entity_boosts;
create policy "Authenticated users can delete entity_boosts"
  on public.entity_boosts for delete to authenticated using (true);


-- =============================
-- 4.12: animal_types
-- =============================
alter table public.animal_types enable row level security;

drop policy if exists "Public can select animal_types" on public.animal_types;
create policy "Public can select animal_types"
  on public.animal_types for select to anon using (true);

drop policy if exists "Authenticated users can select animal_types" on public.animal_types;
create policy "Authenticated users can select animal_types"
  on public.animal_types for select to authenticated using (true);

drop policy if exists "Authenticated users can insert animal_types" on public.animal_types;
create policy "Authenticated users can insert animal_types"
  on public.animal_types for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update animal_types" on public.animal_types;
create policy "Authenticated users can update animal_types"
  on public.animal_types for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete animal_types" on public.animal_types;
create policy "Authenticated users can delete animal_types"
  on public.animal_types for delete to authenticated using (true);


-- =============================
-- 4.13: breeds
-- =============================
alter table public.breeds enable row level security;

drop policy if exists "Public can select breeds" on public.breeds;
create policy "Public can select breeds"
  on public.breeds for select to anon using (true);

drop policy if exists "Authenticated users can select breeds" on public.breeds;
create policy "Authenticated users can select breeds"
  on public.breeds for select to authenticated using (true);

drop policy if exists "Authenticated users can insert breeds" on public.breeds;
create policy "Authenticated users can insert breeds"
  on public.breeds for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update breeds" on public.breeds;
create policy "Authenticated users can update breeds"
  on public.breeds for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete breeds" on public.breeds;
create policy "Authenticated users can delete breeds"
  on public.breeds for delete to authenticated using (true);


-- =============================
-- 4.14: groups
-- =============================
alter table public.groups enable row level security;

drop policy if exists "Public can select groups" on public.groups;
create policy "Public can select groups"
  on public.groups for select to anon using (true);

drop policy if exists "Authenticated users can select groups" on public.groups;
create policy "Authenticated users can select groups"
  on public.groups for select to authenticated using (true);

drop policy if exists "Authenticated users can insert groups" on public.groups;
create policy "Authenticated users can insert groups"
  on public.groups for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update groups" on public.groups;
create policy "Authenticated users can update groups"
  on public.groups for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete groups" on public.groups;
create policy "Authenticated users can delete groups"
  on public.groups for delete to authenticated using (true);


-- =============================
-- 4.15: place_groups
-- =============================
alter table public.place_groups enable row level security;

drop policy if exists "Public can select place_groups" on public.place_groups;
create policy "Public can select place_groups"
  on public.place_groups for select to anon using (true);

drop policy if exists "Authenticated users can select place_groups" on public.place_groups;
create policy "Authenticated users can select place_groups"
  on public.place_groups for select to authenticated using (true);

drop policy if exists "Authenticated users can insert place_groups" on public.place_groups;
create policy "Authenticated users can insert place_groups"
  on public.place_groups for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update place_groups" on public.place_groups;
create policy "Authenticated users can update place_groups"
  on public.place_groups for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete place_groups" on public.place_groups;
create policy "Authenticated users can delete place_groups"
  on public.place_groups for delete to authenticated using (true);


-- =============================
-- 4.16: event_categories
-- =============================
alter table public.event_categories enable row level security;

drop policy if exists "Public can select event_categories" on public.event_categories;
create policy "Public can select event_categories"
  on public.event_categories for select to anon using (true);

drop policy if exists "Authenticated users can select event_categories" on public.event_categories;
create policy "Authenticated users can select event_categories"
  on public.event_categories for select to authenticated using (true);

drop policy if exists "Authenticated users can insert event_categories" on public.event_categories;
create policy "Authenticated users can insert event_categories"
  on public.event_categories for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update event_categories" on public.event_categories;
create policy "Authenticated users can update event_categories"
  on public.event_categories for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete event_categories" on public.event_categories;
create policy "Authenticated users can delete event_categories"
  on public.event_categories for delete to authenticated using (true);


-- =============================
-- 4.17: events
-- =============================
alter table public.events enable row level security;

drop policy if exists "Public can select events" on public.events;
create policy "Public can select events"
  on public.events for select to anon using (true);

drop policy if exists "Authenticated users can select events" on public.events;
create policy "Authenticated users can select events"
  on public.events for select to authenticated using (true);

drop policy if exists "Authenticated users can insert events" on public.events;
create policy "Authenticated users can insert events"
  on public.events for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update events" on public.events;
create policy "Authenticated users can update events"
  on public.events for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete events" on public.events;
create policy "Authenticated users can delete events"
  on public.events for delete to authenticated using (true);


-- =============================
-- 4.18: community_posts
-- =============================
alter table public.community_posts enable row level security;

drop policy if exists "Public can select community_posts" on public.community_posts;
create policy "Public can select community_posts"
  on public.community_posts for select to anon using (true);

drop policy if exists "Authenticated users can select community_posts" on public.community_posts;
create policy "Authenticated users can select community_posts"
  on public.community_posts for select to authenticated using (true);

drop policy if exists "Authenticated users can insert community_posts" on public.community_posts;
create policy "Authenticated users can insert community_posts"
  on public.community_posts for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update community_posts" on public.community_posts;
create policy "Authenticated users can update community_posts"
  on public.community_posts for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete community_posts" on public.community_posts;
create policy "Authenticated users can delete community_posts"
  on public.community_posts for delete to authenticated using (true);


-- =============================
-- 4.19: post_likes
-- =============================
alter table public.post_likes enable row level security;

drop policy if exists "Public can select post_likes" on public.post_likes;
create policy "Public can select post_likes"
  on public.post_likes for select to anon using (true);

drop policy if exists "Authenticated users can select post_likes" on public.post_likes;
create policy "Authenticated users can select post_likes"
  on public.post_likes for select to authenticated using (true);

drop policy if exists "Authenticated users can insert post_likes" on public.post_likes;
create policy "Authenticated users can insert post_likes"
  on public.post_likes for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update post_likes" on public.post_likes;
create policy "Authenticated users can update post_likes"
  on public.post_likes for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete post_likes" on public.post_likes;
create policy "Authenticated users can delete post_likes"
  on public.post_likes for delete to authenticated using (true);


-- =============================
-- 4.20: user_blocks
-- =============================
alter table public.user_blocks enable row level security;

drop policy if exists "Public can select user_blocks" on public.user_blocks;
create policy "Public can select user_blocks"
  on public.user_blocks for select to anon using (true);

drop policy if exists "Authenticated users can select user_blocks" on public.user_blocks;
create policy "Authenticated users can select user_blocks"
  on public.user_blocks for select to authenticated using (true);

drop policy if exists "Authenticated users can insert user_blocks" on public.user_blocks;
create policy "Authenticated users can insert user_blocks"
  on public.user_blocks for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update user_blocks" on public.user_blocks;
create policy "Authenticated users can update user_blocks"
  on public.user_blocks for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete user_blocks" on public.user_blocks;
create policy "Authenticated users can delete user_blocks"
  on public.user_blocks for delete to authenticated using (true);


-- =============================
-- 4.21: reviews
-- =============================
alter table public.reviews enable row level security;

drop policy if exists "Public can select reviews" on public.reviews;
create policy "Public can select reviews"
  on public.reviews for select to anon using (true);

drop policy if exists "Authenticated users can select reviews" on public.reviews;
create policy "Authenticated users can select reviews"
  on public.reviews for select to authenticated using (true);

drop policy if exists "Authenticated users can insert reviews" on public.reviews;
create policy "Authenticated users can insert reviews"
  on public.reviews for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update reviews" on public.reviews;
create policy "Authenticated users can update reviews"
  on public.reviews for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete reviews" on public.reviews;
create policy "Authenticated users can delete reviews"
  on public.reviews for delete to authenticated using (true);


-- =============================
-- 4.22: provider_requests
-- =============================
alter table public.provider_requests enable row level security;

drop policy if exists "Public can select provider_requests" on public.provider_requests;
create policy "Public can select provider_requests"
  on public.provider_requests for select to anon using (true);

drop policy if exists "Authenticated users can select provider_requests" on public.provider_requests;
create policy "Authenticated users can select provider_requests"
  on public.provider_requests for select to authenticated using (true);

drop policy if exists "Authenticated users can insert provider_requests" on public.provider_requests;
create policy "Authenticated users can insert provider_requests"
  on public.provider_requests for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update provider_requests" on public.provider_requests;
create policy "Authenticated users can update provider_requests"
  on public.provider_requests for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete provider_requests" on public.provider_requests;
create policy "Authenticated users can delete provider_requests"
  on public.provider_requests for delete to authenticated using (true);


-- =============================
-- 4.23: rescue_centres
-- =============================
alter table public.rescue_centres enable row level security;

drop policy if exists "Public can select rescue_centres" on public.rescue_centres;
create policy "Public can select rescue_centres"
  on public.rescue_centres for select to anon using (true);

drop policy if exists "Authenticated users can select rescue_centres" on public.rescue_centres;
create policy "Authenticated users can select rescue_centres"
  on public.rescue_centres for select to authenticated using (true);

drop policy if exists "Authenticated users can insert rescue_centres" on public.rescue_centres;
create policy "Authenticated users can insert rescue_centres"
  on public.rescue_centres for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update rescue_centres" on public.rescue_centres;
create policy "Authenticated users can update rescue_centres"
  on public.rescue_centres for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete rescue_centres" on public.rescue_centres;
create policy "Authenticated users can delete rescue_centres"
  on public.rescue_centres for delete to authenticated using (true);


-- =============================
-- 4.24: donation_campaigns
-- =============================
alter table public.donation_campaigns enable row level security;

drop policy if exists "Public can select donation_campaigns" on public.donation_campaigns;
create policy "Public can select donation_campaigns"
  on public.donation_campaigns for select to anon using (true);

drop policy if exists "Authenticated users can select donation_campaigns" on public.donation_campaigns;
create policy "Authenticated users can select donation_campaigns"
  on public.donation_campaigns for select to authenticated using (true);

drop policy if exists "Authenticated users can insert donation_campaigns" on public.donation_campaigns;
create policy "Authenticated users can insert donation_campaigns"
  on public.donation_campaigns for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update donation_campaigns" on public.donation_campaigns;
create policy "Authenticated users can update donation_campaigns"
  on public.donation_campaigns for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete donation_campaigns" on public.donation_campaigns;
create policy "Authenticated users can delete donation_campaigns"
  on public.donation_campaigns for delete to authenticated using (true);


-- =============================
-- 4.25: boost_package_links
-- =============================
alter table public.boost_package_links enable row level security;

drop policy if exists "Public can select boost_package_links" on public.boost_package_links;
create policy "Public can select boost_package_links"
  on public.boost_package_links for select to anon using (true);

drop policy if exists "Authenticated users can select boost_package_links" on public.boost_package_links;
create policy "Authenticated users can select boost_package_links"
  on public.boost_package_links for select to authenticated using (true);

drop policy if exists "Authenticated users can insert boost_package_links" on public.boost_package_links;
create policy "Authenticated users can insert boost_package_links"
  on public.boost_package_links for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update boost_package_links" on public.boost_package_links;
create policy "Authenticated users can update boost_package_links"
  on public.boost_package_links for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete boost_package_links" on public.boost_package_links;
create policy "Authenticated users can delete boost_package_links"
  on public.boost_package_links for delete to authenticated using (true);


-- =============================
-- 4.26: saved_places
-- =============================
alter table public.saved_places enable row level security;

drop policy if exists "Public can select saved_places" on public.saved_places;
create policy "Public can select saved_places"
  on public.saved_places for select to anon using (true);

drop policy if exists "Authenticated users can select saved_places" on public.saved_places;
create policy "Authenticated users can select saved_places"
  on public.saved_places for select to authenticated using (true);

drop policy if exists "Authenticated users can insert saved_places" on public.saved_places;
create policy "Authenticated users can insert saved_places"
  on public.saved_places for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update saved_places" on public.saved_places;
create policy "Authenticated users can update saved_places"
  on public.saved_places for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete saved_places" on public.saved_places;
create policy "Authenticated users can delete saved_places"
  on public.saved_places for delete to authenticated using (true);


-- =============================
-- 4.27: support_tickets
-- =============================
alter table public.support_tickets enable row level security;

drop policy if exists "Public can select support_tickets" on public.support_tickets;
create policy "Public can select support_tickets"
  on public.support_tickets for select to anon using (true);

drop policy if exists "Authenticated users can select support_tickets" on public.support_tickets;
create policy "Authenticated users can select support_tickets"
  on public.support_tickets for select to authenticated using (true);

drop policy if exists "Authenticated users can insert support_tickets" on public.support_tickets;
create policy "Authenticated users can insert support_tickets"
  on public.support_tickets for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update support_tickets" on public.support_tickets;
create policy "Authenticated users can update support_tickets"
  on public.support_tickets for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete support_tickets" on public.support_tickets;
create policy "Authenticated users can delete support_tickets"
  on public.support_tickets for delete to authenticated using (true);


-- =============================
-- 4.28: support_replies
-- =============================
alter table public.support_replies enable row level security;

drop policy if exists "Public can select support_replies" on public.support_replies;
create policy "Public can select support_replies"
  on public.support_replies for select to anon using (true);

drop policy if exists "Authenticated users can select support_replies" on public.support_replies;
create policy "Authenticated users can select support_replies"
  on public.support_replies for select to authenticated using (true);

drop policy if exists "Authenticated users can insert support_replies" on public.support_replies;
create policy "Authenticated users can insert support_replies"
  on public.support_replies for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update support_replies" on public.support_replies;
create policy "Authenticated users can update support_replies"
  on public.support_replies for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete support_replies" on public.support_replies;
create policy "Authenticated users can delete support_replies"
  on public.support_replies for delete to authenticated using (true);


-- =============================
-- 4.29: notifications
-- =============================
alter table public.notifications enable row level security;

drop policy if exists "Public can select notifications" on public.notifications;
create policy "Public can select notifications"
  on public.notifications for select to anon using (true);

drop policy if exists "Authenticated users can select notifications" on public.notifications;
create policy "Authenticated users can select notifications"
  on public.notifications for select to authenticated using (true);

drop policy if exists "Authenticated users can insert notifications" on public.notifications;
create policy "Authenticated users can insert notifications"
  on public.notifications for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update notifications" on public.notifications;
create policy "Authenticated users can update notifications"
  on public.notifications for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete notifications" on public.notifications;
create policy "Authenticated users can delete notifications"
  on public.notifications for delete to authenticated using (true);


-- =============================
-- 4.30: audit_logs
-- =============================
alter table public.audit_logs enable row level security;

drop policy if exists "Public can select audit_logs" on public.audit_logs;
create policy "Public can select audit_logs"
  on public.audit_logs for select to anon using (true);

drop policy if exists "Authenticated users can select audit_logs" on public.audit_logs;
create policy "Authenticated users can select audit_logs"
  on public.audit_logs for select to authenticated using (true);

drop policy if exists "Authenticated users can insert audit_logs" on public.audit_logs;
create policy "Authenticated users can insert audit_logs"
  on public.audit_logs for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update audit_logs" on public.audit_logs;
create policy "Authenticated users can update audit_logs"
  on public.audit_logs for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete audit_logs" on public.audit_logs;
create policy "Authenticated users can delete audit_logs"
  on public.audit_logs for delete to authenticated using (true);


-- =============================
-- 4.32: community_comments
-- =============================
alter table public.community_comments enable row level security;

drop policy if exists "Public can select community_comments" on public.community_comments;
create policy "Public can select community_comments"
  on public.community_comments for select to anon using (true);

drop policy if exists "Authenticated users can select community_comments" on public.community_comments;
create policy "Authenticated users can select community_comments"
  on public.community_comments for select to authenticated using (true);

drop policy if exists "Authenticated users can insert community_comments" on public.community_comments;
create policy "Authenticated users can insert community_comments"
  on public.community_comments for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update community_comments" on public.community_comments;
create policy "Authenticated users can update community_comments"
  on public.community_comments for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete community_comments" on public.community_comments;
create policy "Authenticated users can delete community_comments"
  on public.community_comments for delete to authenticated using (true);


-- =============================
-- 4.33: service_provider_breeds
-- =============================
alter table public.service_provider_breeds enable row level security;

drop policy if exists "Public can select service_provider_breeds" on public.service_provider_breeds;
create policy "Public can select service_provider_breeds"
  on public.service_provider_breeds for select to anon using (true);

drop policy if exists "Authenticated users can select service_provider_breeds" on public.service_provider_breeds;
create policy "Authenticated users can select service_provider_breeds"
  on public.service_provider_breeds for select to authenticated using (true);

drop policy if exists "Authenticated users can insert service_provider_breeds" on public.service_provider_breeds;
create policy "Authenticated users can insert service_provider_breeds"
  on public.service_provider_breeds for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update service_provider_breeds" on public.service_provider_breeds;
create policy "Authenticated users can update service_provider_breeds"
  on public.service_provider_breeds for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete service_provider_breeds" on public.service_provider_breeds;
create policy "Authenticated users can delete service_provider_breeds"
  on public.service_provider_breeds for delete to authenticated using (true);


-- =============================
-- 4.34: whats_new
-- =============================
alter table public.whats_new enable row level security;

drop policy if exists "Public can select whats_new" on public.whats_new;
create policy "Public can select whats_new"
  on public.whats_new for select to anon using (true);

drop policy if exists "Authenticated users can select whats_new" on public.whats_new;
create policy "Authenticated users can select whats_new"
  on public.whats_new for select to authenticated using (true);

drop policy if exists "Authenticated users can insert whats_new" on public.whats_new;
create policy "Authenticated users can insert whats_new"
  on public.whats_new for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update whats_new" on public.whats_new;
create policy "Authenticated users can update whats_new"
  on public.whats_new for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete whats_new" on public.whats_new;
create policy "Authenticated users can delete whats_new"
  on public.whats_new for delete to authenticated using (true);


