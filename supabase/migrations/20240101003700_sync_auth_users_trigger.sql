-- ============================================================
-- MIGRATION 036: SYNC AUTH USERS TRIGGER
-- Auto-syncs new auth.users rows to public.users table
-- ============================================================

-- Drop existing trigger first (clean reinstall)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name, surname, user_type, is_verified)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'surname', ''),
    coalesce(new.raw_user_meta_data->>'roleName', 'Guest'),
    true
  )
  ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
