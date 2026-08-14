-- ############################################################################
-- FOLLOW-UP — stop email addresses leaking through users.name
-- ############################################################################
-- Found by running the smoke tests: revoking users.email worked, but a live
-- request (GET /rest/v1/users?select=name) returned an actual email address in
-- the name column instead. Measured against production: 2 of 35 rows.
--
-- Root cause: handle_new_user reads raw_user_meta_data->>'name', but the app
-- signs up with 'full_name'. That branch is always null for email/password
-- signups, so it always falls back to storing the raw email as the name.
--
-- This does NOT touch handle_new_user (production's version may differ from
-- anything in this repo). It adds a small, additive BEFORE trigger that
-- rewrites an email-shaped name down to its local part, plus a one-time cleanup
-- of the 2 rows already affected. Wrapped so it is all-or-nothing.
-- ############################################################################

BEGIN;

CREATE OR REPLACE FUNCTION public.sanitize_user_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT NULL AND NEW.name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    NEW.name := split_part(NEW.name, '@', 1);
  END IF;

  IF NEW.name IS NULL OR btrim(NEW.name) = '' THEN
    NEW.name := 'user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_user_display_name_trigger ON public.users;
CREATE TRIGGER sanitize_user_display_name_trigger
  BEFORE INSERT OR UPDATE OF name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_user_display_name();

UPDATE public.users
   SET name = split_part(name, '@', 1)
 WHERE name IS NOT NULL
   AND name = email
   AND name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

COMMIT;

-- ############################################################################
-- VERIFY — run as a separate query after the COMMIT above succeeds.
-- ############################################################################
SELECT
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'FAIL' END AS result,
  'no email-shaped names remain'                    AS check_name,
  count(*)                                          AS remaining
  FROM public.users
 WHERE name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

-- Then confirm from outside with only the publishable anon key:
--   GET /rest/v1/public_users?select=name&name=like.*@*   -> expect []
