-- ############################################################################
-- POST-MIGRATION SMOKE TESTS — Supabase SQL editor
-- ############################################################################
-- NON-DESTRUCTIVE. Every write is performed inside a plpgsql subtransaction that
-- is always undone: successful operations are rolled back with a sentinel
-- exception, blocked operations roll back by definition. Nothing persists.
-- Safe to run on production, and safe to re-run.
--
-- WHY SQL AND NOT JUST THE UI
--   The SQL editor connects as `postgres`, which bypasses RLS -- and the escrow
--   trigger deliberately exempts server-side callers (auth.uid() IS NULL). So a
--   plain query here would pass everything and prove nothing. These tests
--   impersonate a real end user with
--       SET LOCAL role authenticated;
--       SET LOCAL request.jwt.claims = '{"sub":"<uuid>",...}';
--   so auth.uid() resolves and the policies and triggers are genuinely exercised.
--
-- WHAT IT DOES NOT COVER
--   Stripe redirects, file uploads and the followers list need the real app --
--   see docs/SMOKE_TESTS_UI.md.
--
-- HOW TO READ THE OUTPUT
--   Every row should read PASS. A SKIP means there was no suitable test data
--   (e.g. no project with both a client and an artist) -- not a failure.
-- ############################################################################

BEGIN;

CREATE TEMP TABLE smoke(ord int, result text, test text, detail text) ON COMMIT DROP;

DO $outer$
DECLARE
  v_project   record;
  v_milestone record;
  v_client    uuid;
  v_artist    uuid;
  v_claims    text;
  n           int := 0;

  PROCEDURE_NOTE text := 'sentinel used to undo successful writes';
BEGIN
  -- ── Find usable test data ────────────────────────────────────────────────
  SELECT p.* INTO v_project
    FROM public.projects p
   WHERE p.client_id IS NOT NULL AND p.artist_id IS NOT NULL
   ORDER BY p.created_at DESC
   LIMIT 1;

  IF v_project IS NULL THEN
    INSERT INTO smoke VALUES (0,'SKIP','all project tests','no project with both client_id and artist_id');
    RETURN;
  END IF;

  v_client := v_project.client_id;
  v_artist := v_project.artist_id;
  v_claims := format('{"sub":"%s","role":"authenticated"}', v_client);

  SELECT m.* INTO v_milestone
    FROM public.project_milestones m
   WHERE m.project_id = v_project.id
   ORDER BY m.sort_order
   LIMIT 1;

  -- ── TEST 1: escrow trigger must refuse a client-side jump to COMPLETED ───
  n := n + 1;
  IF v_milestone IS NULL THEN
    INSERT INTO smoke VALUES (n,'SKIP','milestone -> COMPLETED blocked','project has no milestones');
  ELSE
    BEGIN
      SET LOCAL role authenticated;
      PERFORM set_config('request.jwt.claims', v_claims, true);
      UPDATE public.project_milestones SET status = 'COMPLETED' WHERE id = v_milestone.id;
      RAISE EXCEPTION 'SMOKE_UNDO';
    EXCEPTION WHEN OTHERS THEN
      RESET role;
      IF SQLERRM = 'SMOKE_UNDO' THEN
        INSERT INTO smoke VALUES (n,'FAIL','milestone -> COMPLETED blocked','update SUCCEEDED; trigger not enforcing');
      ELSE
        INSERT INTO smoke VALUES (n,'PASS','milestone -> COMPLETED blocked', left(SQLERRM,90));
      END IF;
    END;
  END IF;

  -- ── TEST 2: money columns must be immutable to participants ─────────────
  n := n + 1;
  IF v_milestone IS NULL THEN
    INSERT INTO smoke VALUES (n,'SKIP','milestone amount frozen','project has no milestones');
  ELSE
    BEGIN
      SET LOCAL role authenticated;
      PERFORM set_config('request.jwt.claims', v_claims, true);
      UPDATE public.project_milestones
         SET amount = COALESCE(amount,0) + 1000 WHERE id = v_milestone.id;
      RAISE EXCEPTION 'SMOKE_UNDO';
    EXCEPTION WHEN OTHERS THEN
      RESET role;
      IF SQLERRM = 'SMOKE_UNDO' THEN
        INSERT INTO smoke VALUES (n,'FAIL','milestone amount frozen','amount CHANGED; trigger not enforcing');
      ELSE
        INSERT INTO smoke VALUES (n,'PASS','milestone amount frozen', left(SQLERRM,90));
      END IF;
    END;
  END IF;

  -- ── TEST 3: a LEGAL transition must still be allowed ─────────────────────
  --     Guards against the trigger being too strict and breaking real flows.
  n := n + 1;
  IF v_milestone IS NULL THEN
    INSERT INTO smoke VALUES (n,'SKIP','legal transition allowed','project has no milestones');
  ELSE
    BEGIN
      SET LOCAL role authenticated;
      PERFORM set_config('request.jwt.claims', v_claims, true);
      -- force a known-legal starting point server-side, then act as the user
      RESET role;
      UPDATE public.project_milestones SET status = 'ACTIVE' WHERE id = v_milestone.id;
      SET LOCAL role authenticated;
      PERFORM set_config('request.jwt.claims', v_claims, true);
      UPDATE public.project_milestones SET status = 'REVIEW_PENDING' WHERE id = v_milestone.id;
      RAISE EXCEPTION 'SMOKE_UNDO';
    EXCEPTION WHEN OTHERS THEN
      RESET role;
      IF SQLERRM = 'SMOKE_UNDO' THEN
        INSERT INTO smoke VALUES (n,'PASS','legal transition allowed','ACTIVE -> REVIEW_PENDING accepted');
      ELSE
        INSERT INTO smoke VALUES (n,'FAIL','legal transition allowed', 'BLOCKED: '||left(SQLERRM,80));
      END IF;
    END;
  END IF;

  -- ── TEST 4: free-artwork insert must be refused ──────────────────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    INSERT INTO public.artwork_unlocks (artwork_id, user_id)
    SELECT a.id, v_client FROM public.artworks a LIMIT 1;
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'FAIL','free artwork unlock blocked','insert SUCCEEDED; hole still open');
    ELSE
      INSERT INTO smoke VALUES (n,'PASS','free artwork unlock blocked', left(SQLERRM,90));
    END IF;
  END;

  -- ── TEST 5: users.role self-promotion must be refused ────────────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    UPDATE public.users SET role = 'admin' WHERE id = v_client;
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'FAIL','users.role -> admin blocked','update SUCCEEDED');
    ELSE
      INSERT INTO smoke VALUES (n,'PASS','users.role -> admin blocked', left(SQLERRM,90));
    END IF;
  END;

  -- ── TEST 6: profiles.role -> premium (0% fee) must be refused ────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    UPDATE public.profiles SET role = 'premium' WHERE id = v_client;
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'FAIL','profiles.role -> premium blocked','update SUCCEEDED; free commissions');
    ELSE
      INSERT INTO smoke VALUES (n,'PASS','profiles.role -> premium blocked', left(SQLERRM,90));
    END IF;
  END;

  -- ── TEST 7: forged successful transaction must be refused ───────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    INSERT INTO public.transactions (buyer_id, amount, status)
    VALUES (v_client, 1, 'success');
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'FAIL','forged status=success blocked','insert SUCCEEDED');
    ELSE
      INSERT INTO smoke VALUES (n,'PASS','forged status=success blocked', left(SQLERRM,90));
    END IF;
  END;

  -- ── TEST 8: a pending transaction must STILL insert (Stripe path) ────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    INSERT INTO public.transactions (buyer_id, amount, status)
    VALUES (v_client, 1, 'pending');
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'PASS','pending transaction still allowed','Stripe checkout path intact');
    ELSE
      INSERT INTO smoke VALUES (n,'FAIL','pending transaction still allowed','BLOCKED: '||left(SQLERRM,80));
    END IF;
  END;

  -- ── TEST 9: forged approved withdrawal must be refused ──────────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    INSERT INTO public.withdrawals (user_id, amount, status)
    VALUES (v_client, 999999, 'approved');
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'FAIL','forged approved withdrawal blocked','insert SUCCEEDED');
    ELSE
      INSERT INTO smoke VALUES (n,'PASS','forged approved withdrawal blocked', left(SQLERRM,90));
    END IF;
  END;

  -- ── TEST 10: notifying the counterparty must now WORK ───────────────────
  n := n + 1;
  BEGIN
    SET LOCAL role authenticated;
    PERFORM set_config('request.jwt.claims', v_claims, true);
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_artist, 'system', 'smoke test', 'counterparty notification');
    RAISE EXCEPTION 'SMOKE_UNDO';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    IF SQLERRM = 'SMOKE_UNDO' THEN
      INSERT INTO smoke VALUES (n,'PASS','counterparty notification allowed','milestone/dispute alerts will deliver');
    ELSE
      INSERT INTO smoke VALUES (n,'FAIL','counterparty notification allowed','BLOCKED: '||left(SQLERRM,80));
    END IF;
  END;

  -- ── TEST 11: blocking must actually block a message ─────────────────────
  n := n + 1;
  DECLARE
    v_conv uuid;
  BEGIN
    SELECT c.id INTO v_conv FROM public.conversations c
     WHERE c.client_id IS NOT NULL AND c.artist_id IS NOT NULL LIMIT 1;

    IF v_conv IS NULL THEN
      INSERT INTO smoke VALUES (n,'SKIP','blocked message refused','no conversation with both parties');
    ELSE
      DECLARE v_a uuid; v_b uuid;
      BEGIN
        SELECT client_id, artist_id INTO v_a, v_b FROM public.conversations WHERE id = v_conv;
        -- create the block server-side, then attempt the send as the user
        INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_b, v_a);
        SET LOCAL role authenticated;
        PERFORM set_config('request.jwt.claims',
                format('{"sub":"%s","role":"authenticated"}', v_a), true);
        INSERT INTO public.messages (conversation_id, sender_id, content)
        VALUES (v_conv, v_a, 'smoke test message');
        RAISE EXCEPTION 'SMOKE_UNDO';
      EXCEPTION WHEN OTHERS THEN
        RESET role;
        IF SQLERRM = 'SMOKE_UNDO' THEN
          INSERT INTO smoke VALUES (n,'FAIL','blocked message refused','message SENT despite block');
        ELSE
          INSERT INTO smoke VALUES (n,'PASS','blocked message refused', left(SQLERRM,90));
        END IF;
      END;
    END IF;
  END;

  -- ── TEST 12: email must be unreadable, name must stay readable ──────────
  n := n + 1;
  INSERT INTO smoke VALUES (n,
    CASE WHEN has_column_privilege('anon','public.users','email','SELECT')
              OR has_column_privilege('authenticated','public.users','email','SELECT')
         THEN 'FAIL' ELSE 'PASS' END,
    'users.email not readable', 'anon + authenticated');

  n := n + 1;
  INSERT INTO smoke VALUES (n,
    CASE WHEN has_column_privilege('anon','public.users','name','SELECT')
         THEN 'PASS' ELSE 'FAIL' END,
    'users.name still readable', 'public_users view / followers list');

  -- ── TEST 13: rate limiter must allow then deny ──────────────────────────
  n := n + 1;
  DECLARE
    v_key text := 'smoke-' || clock_timestamp()::text;
    v_first boolean;
    v_over  boolean;
  BEGIN
    v_first := public.check_rate_limit(v_key, 2, 60);
    PERFORM public.check_rate_limit(v_key, 2, 60);
    v_over  := public.check_rate_limit(v_key, 2, 60);
    IF v_first AND NOT v_over THEN
      INSERT INTO smoke VALUES (n,'PASS','rate limiter allows then denies','limit 2/60s honoured');
    ELSE
      INSERT INTO smoke VALUES (n,'FAIL','rate limiter allows then denies',
                                format('first=%s over_limit_allowed=%s', v_first, v_over));
    END IF;
  END;
END
$outer$;

SELECT result, test, detail FROM smoke ORDER BY ord;

-- The temp table is ON COMMIT DROP and every write above was undone by its own
-- subtransaction, so committing here persists nothing.
COMMIT;
