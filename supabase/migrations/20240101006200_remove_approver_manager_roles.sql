-- Retire these roles without deleting users or promoting their accounts.
BEGIN;
UPDATE public.users SET user_type = 'Guest'
WHERE lower(trim(user_type)) IN ('approver', 'manager');
DELETE FROM public.roles WHERE lower(trim(name)) IN ('approver', 'manager');
-- user_roles and role_permissions reference roles with ON DELETE CASCADE.
COMMIT;
