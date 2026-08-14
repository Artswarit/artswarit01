-- ============================================================================
-- Production verification — PART 2 (last unknowns before applying migrations)
-- ============================================================================
-- Read-only. Single result set. Run once, set Limit to 500.
--
-- WHY: migration 20260810120000 closes two holes by DROPping named policies:
--        "Allow buyers to create transactions"  ON transactions
--        "Service role can insert unlocks"      ON artwork_unlocks
--      Those names come from the repo's migration files. Production's schema was
--      largely applied out-of-band, so if the live policies carry DIFFERENT
--      names, `DROP POLICY IF EXISTS` silently does nothing and the holes stay
--      open while the migration still reports success. Need the real names.
--
--      Also resolves whether the withdrawals INSERT policy constrains `status`
--      -- Part 1 showed the policy exists but only returned its USING clause
--      (always NULL for INSERT), not its WITH CHECK.
-- ============================================================================

SELECT
  p.tablename::text                                        AS "table",
  p.policyname::text                                       AS policy_name,
  p.cmd::text                                              AS command,
  COALESCE(array_to_string(p.roles, ','), '-')::text        AS roles,
  COALESCE(p.qual, '(none)')::text                          AS using_expr,
  COALESCE(p.with_check, '(none)')::text                    AS with_check_expr
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    -- the two whose policy names my migration must match exactly
    'transactions',
    'artwork_unlocks',
    -- withdrawals: does the INSERT policy allow a self-approved row?
    'withdrawals',
    -- notifications: audit says INSERT is WITH CHECK (true) i.e. spoofable;
    -- peer-to-peer inserts are load-bearing so this is informational only
    'notifications',
    -- confirm the two policies I rewrite are the ones actually live
    'users',
    'profiles',
    'project_milestones',
    'disputes'
  )
ORDER BY
  -- surface the blocking ones first
  CASE p.tablename
    WHEN 'transactions' THEN 1
    WHEN 'artwork_unlocks' THEN 2
    WHEN 'withdrawals' THEN 3
    ELSE 4
  END,
  p.tablename, p.cmd, p.policyname;


-- ---------------------------------------------------------------------------
-- WHAT TO LOOK FOR
--
-- transactions    -> an INSERT policy whose with_check does not pin `status`.
--                    Note its EXACT policyname; if it is not
--                    "Allow buyers to create transactions", tell me and I will
--                    correct the migration before you apply it.
--
-- artwork_unlocks -> an INSERT policy with with_check = `true`. Same: I need the
--                    exact name. This is the free-artwork hole.
--
-- withdrawals     -> INSERT with_check. If it is `(auth.uid() = user_id)` with
--                    no constraint on `status`, a user can insert a withdrawal
--                    already marked approved/paid. `status` is plain text with
--                    no CHECK constraint, so nothing else stops it. Part 1
--                    confirmed there is no UPDATE policy, so post-hoc editing
--                    is blocked -- but insert-time forgery may not be.
--
-- project_milestones / users / profiles / disputes
--                 -> confirm the policy names match what the migration
--                    replaces, so it substitutes rather than adding a second
--                    permissive policy alongside.
-- ---------------------------------------------------------------------------
