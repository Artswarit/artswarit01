-- ############################################################################
-- Stop email addresses leaking through public.users.name
-- ############################################################################
-- SEVERITY: High (PII exposure to unauthenticated callers)
--
-- FOUND BY TESTING, NOT BY READING
--   After revoking users.email from anon/authenticated, a live anon request
--   returned:
--       GET /rest/v1/users?select=name  ->  [{"name":"someone@gmail.com"}]
--   The email column is now correctly denied, but a full email address was
--   sitting in the `name` column, which is publicly readable and is also
--   projected by the `public_users` view (used by FollowersList.tsx).
--
--   Measured against production: 2 of 35 users in public_users, and 0 of 30 in
--   public_profiles (profiles.full_name is clean).
--
-- ROOT CAUSE
--   The handle_new_user trigger inserts:
--       COALESCE(new.raw_user_meta_data->>'name', new.email)
--   but the app signs users up with the metadata key `full_name`, not `name`
--   (AuthContext.signUp passes { full_name, role }). So the first branch is
--   ALWAYS null for email/password signups and the fallback to the raw email
--   always fires. Google OAuth happens to set `name`, which is why only some
--   rows are affected.
--
-- WHY A SEPARATE TRIGGER RATHER THAN EDITING handle_new_user
--   Much of this schema was applied out-of-band, so the production body of
--   handle_new_user may differ from any version in this repo. Rewriting it
--   risks silently dropping changes that only exist in production. This adds a
--   small, additive sanitiser instead, which composes with whatever that
--   function currently does.
--
-- REVERSIBILITY
--   The cleanup below only rewrites `name` where it equals the user's own
--   email. The original value is still available in users.email, so it is fully
--   recoverable:  UPDATE public.users SET name = email WHERE ...
-- ############################################################################

-- ---------------------------------------------------------------------------
-- 1. Sanitiser: never store a full email address in the public `name` column.
--    Keeps the local part, which is still a usable display name but is not a
--    deliverable address, so it cannot be harvested for spam or credential
--    stuffing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_user_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when the name IS an email address. A name that merely contains an
  -- '@' (e.g. a handle) is left alone.
  IF NEW.name IS NOT NULL AND NEW.name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    NEW.name := split_part(NEW.name, '@', 1);
  END IF;

  -- Never leave it empty.
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

-- ---------------------------------------------------------------------------
-- 2. One-time cleanup of rows already carrying an email as their name.
--    Scoped to rows where name = the user's own email, so it cannot touch a
--    legitimately chosen display name that happens to look like an address.
-- ---------------------------------------------------------------------------
UPDATE public.users
   SET name = split_part(name, '@', 1)
 WHERE name IS NOT NULL
   AND name = email
   AND name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

-- ---------------------------------------------------------------------------
-- VERIFY (run separately):
--
--   -- expect 0
--   SELECT count(*) AS emails_still_in_name
--     FROM public.users
--    WHERE name ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
--
--   -- and from outside, with only the publishable anon key (expect no '@'):
--   --   GET /rest/v1/public_users?select=name&name=like.*@*   -> []
-- ---------------------------------------------------------------------------

-- ############################################################################
-- STILL TO DO (application-side, not fixed here)
--   handle_new_user reads raw_user_meta_data->>'name' while the app sends
--   'full_name'. This trigger stops the PII leak, but the underlying mismatch
--   means new users get a display name derived from their email local part
--   rather than the name they actually typed at signup. The proper fix is to
--   have that function read 'full_name' first:
--       COALESCE(raw_user_meta_data->>'full_name',
--                raw_user_meta_data->>'name',
--                split_part(new.email,'@',1))
--   Deliberately not done here -- it requires seeing production's current
--   function body first (see note above).
-- ############################################################################
