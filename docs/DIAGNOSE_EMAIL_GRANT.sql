-- ############################################################################
-- DEFINITIVE DIAGNOSTIC — can anon/authenticated actually read users.email?
-- ############################################################################
-- Read-only. Run the whole thing; it returns one combined result set.
--
-- WHY A NEW DIAGNOSTIC
--   My previous check used information_schema.column_privileges. That view only
--   exposes privileges where the grantor or grantee is a "currently enabled
--   role", and it also materialises table-level grants as one row per column.
--   It can therefore report a row for `email` that does not correspond to real,
--   effective access — i.e. the FAIL may be an artefact of my check rather than
--   a live grant.
--
--   has_column_privilege() is the authoritative test: it answers "could this
--   role actually SELECT this column", accounting for table-level grants,
--   column-level grants, PUBLIC, and role inheritance. Section A is the answer
--   that matters. Sections B–D explain it if A says yes.
-- ############################################################################

-- ── A. THE ANSWER ──────────────────────────────────────────────────────────
SELECT 'A_EFFECTIVE' AS section,
       'anon can SELECT users.email' AS item,
       has_column_privilege('anon', 'public.users', 'email', 'SELECT')::text AS value
UNION ALL
SELECT 'A_EFFECTIVE', 'authenticated can SELECT users.email',
       has_column_privilege('authenticated', 'public.users', 'email', 'SELECT')::text
UNION ALL
-- Control: these SHOULD be true, proving the view keeps working.
SELECT 'A_EFFECTIVE', 'anon can SELECT users.name (must stay true)',
       has_column_privilege('anon', 'public.users', 'name', 'SELECT')::text
UNION ALL
SELECT 'A_EFFECTIVE', 'authenticated can SELECT users.name (must stay true)',
       has_column_privilege('authenticated', 'public.users', 'name', 'SELECT')::text

-- ── B. RAW TABLE ACL — shows grantee=privileges/grantor ────────────────────
UNION ALL
SELECT 'B_TABLE_ACL', 'owner', c.relowner::regrole::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'users'
UNION ALL
SELECT 'B_TABLE_ACL', 'relacl', COALESCE(c.relacl::text, '(null = owner-only defaults)')
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'users'

-- ── C. RAW COLUMN ACL for email ────────────────────────────────────────────
UNION ALL
SELECT 'C_COLUMN_ACL', a.attname, COALESCE(a.attacl::text, '(none — inherits table ACL)')
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relname = 'users'
   AND a.attnum > 0 AND NOT a.attisdropped
   AND a.attname IN ('email', 'name')

-- ── D. Is the current session even able to revoke? ─────────────────────────
--     REVOKE silently no-ops if the executing role is neither the object owner
--     nor the grantor of the privilege.
UNION ALL
SELECT 'D_SESSION', 'current_user', current_user::text
UNION ALL
SELECT 'D_SESSION', 'is current_user the table owner',
       (pg_get_userbyid((SELECT relowner FROM pg_class c
          JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname='users')) = current_user)::text

-- ── E. Views over users that could re-expose email ─────────────────────────
UNION ALL
SELECT 'E_VIEWS', v.viewname,
       CASE WHEN v.definition ILIKE '%email%' THEN '*** references email ***'
            ELSE 'no email reference' END
  FROM pg_views v
 WHERE v.schemaname = 'public'
   AND v.definition ILIKE '%users%'

ORDER BY 1, 2;

-- ############################################################################
-- HOW TO READ IT
--
--   A: anon/authenticated "can SELECT users.email" = false
--        -> The fix DID work. The earlier FAIL was my check misreading
--           information_schema. Nothing further to do; treat as closed.
--
--   A: ...= true  -> access is real. Then:
--
--      C shows an attacl entry for email mentioning anon/authenticated
--        -> a column grant survives. Re-run the column REVOKE as the owner.
--
--      C shows "(none)" but B's relacl lists anon=r/... or authenticated=r/...
--        -> a TABLE-level grant is still present, so every column is readable.
--           My REVOKE could not remove it, most likely because it was issued by
--           a different grantor (note the role after the "/" in relacl).
--           Fix: run the REVOKE as that grantor, or as the table owner.
--
--      D says current_user is NOT the owner
--        -> that is the cause. REVOKE no-ops without error in that case.
--           Re-run as the owner shown in B, or via the service_role connection.
--
--      E flags a view referencing email that is granted to anon
--        -> email is reachable through the view regardless of table grants.
--           public_users is expected here and does NOT project email; any OTHER
--           view that does needs the same treatment.
-- ############################################################################
