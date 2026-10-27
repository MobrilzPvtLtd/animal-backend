-- Deploy with the role alias compatibility code. Preserve assignments and the
-- union of Owner/Admin permissions while consolidating to one database role.
BEGIN;

LOCK TABLE public.roles, public.user_roles, public.role_permissions IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  canonical_id bigint;
  legacy_ids bigint[];
BEGIN
  SELECT role_id INTO canonical_id FROM public.roles WHERE name = 'Super Admin';
  IF canonical_id IS NULL THEN
    SELECT role_id INTO canonical_id FROM public.roles
    WHERE lower(trim(name)) IN ('owner', 'admin')
    ORDER BY CASE WHEN lower(trim(name)) = 'owner' THEN 0 ELSE 1 END, role_id LIMIT 1;
  END IF;
  IF canonical_id IS NULL THEN
    INSERT INTO public.roles (name, description, is_system_role)
    VALUES ('Super Admin', 'Full platform administration', true)
    RETURNING role_id INTO canonical_id;
  END IF;

  SELECT coalesce(array_agg(role_id), ARRAY[]::bigint[]) INTO legacy_ids
  FROM public.roles
  WHERE lower(trim(name)) IN ('owner', 'admin', 'super admin', 'super_admin', 'superadmin')
    AND role_id <> canonical_id;

  -- Do not silently discard conflicting entity links when collapsing roles.
  IF EXISTS (
    SELECT user_id FROM public.user_roles
    WHERE role_id = canonical_id OR role_id = ANY(legacy_ids)
    GROUP BY user_id
    HAVING count(DISTINCT vet_id) > 1 OR count(DISTINCT breeder_id) > 1
      OR count(DISTINCT pet_friendly_place_id) > 1 OR count(DISTINCT service_provider_id) > 1
  ) THEN
    RAISE EXCEPTION 'Conflicting administrator entity links must be resolved before merging roles';
  END IF;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT DISTINCT canonical_id, permission_id FROM public.role_permissions
  WHERE role_id = ANY(legacy_ids)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_id, vet_id, breeder_id, pet_friendly_place_id, service_provider_id, created_at)
  SELECT user_id, canonical_id, max(vet_id), max(breeder_id), max(pet_friendly_place_id), max(service_provider_id), min(created_at)
  FROM public.user_roles
  WHERE role_id = canonical_id OR role_id = ANY(legacy_ids)
  GROUP BY user_id
  ON CONFLICT (user_id, role_id) DO UPDATE SET
    vet_id = EXCLUDED.vet_id,
    breeder_id = EXCLUDED.breeder_id,
    pet_friendly_place_id = EXCLUDED.pet_friendly_place_id,
    service_provider_id = EXCLUDED.service_provider_id,
    created_at = EXCLUDED.created_at;

  DELETE FROM public.user_roles WHERE role_id = ANY(legacy_ids);
  DELETE FROM public.role_permissions WHERE role_id = ANY(legacy_ids);
  DELETE FROM public.roles WHERE role_id = ANY(legacy_ids);

  UPDATE public.roles SET name = 'Super Admin', description = 'Full platform administration', is_system_role = true
  WHERE role_id = canonical_id;
  UPDATE public.users SET user_type = 'Super Admin'
  WHERE lower(trim(user_type)) IN ('owner', 'admin', 'super_admin', 'superadmin');
END $$;

COMMIT;
