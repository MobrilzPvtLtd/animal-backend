-- Migration 054: Add device_id to users and function to terminate other sessions for single-device restriction
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE OR REPLACE FUNCTION public.terminate_other_sessions(target_auth_user_id UUID, keep_session_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF keep_session_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = target_auth_user_id AND id != keep_session_id;
  ELSE
    DELETE FROM auth.sessions WHERE user_id = target_auth_user_id;
  END IF;
END;
$$;
