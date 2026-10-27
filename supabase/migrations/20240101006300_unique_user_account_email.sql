-- Fail explicitly if legacy duplicates need review; never merge/delete users.
-- The unique index also protects direct writes and simultaneous requests.
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim(email)) FROM public.users
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY lower(btrim(email)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate normalized account emails exist. Review these accounts before applying the unique email migration.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_normalized_unique
ON public.users (lower(btrim(email)))
WHERE email IS NOT NULL AND btrim(email) <> '';
COMMIT;
