# UI smoke tests — after applying the security migrations

Five checks the SQL tests can't cover, because they involve Stripe redirects, file
uploads, or a `security_invoker` view read through the API. Run these in the live
app at https://artswarit.lovable.app (or a local `npm run dev`).

Each one maps to something the migration changed. Expected time: ~10 minutes.

---

## 1. Raise a dispute — the P0 fix
**Why:** `disputes.previous_status` was missing in production, so the INSERT in
`DisputeDialog.tsx:108` referenced a non-existent column. **Raising a dispute did
not work at all before this migration.**

1. As a client, open a project with a funded (`ACTIVE`) or in-review milestone.
2. Raise a dispute with a reason.

- ✅ **Expect:** it saves, the milestone shows as disputed, and the artist
  receives a notification.
- ❌ **If it fails:** capture the exact error — this is the highest-value fix in
  the batch and it regressing means the column add didn't take.

Then **withdraw** the dispute. It should genuinely close now (previously the
withdraw matched 0 rows and left the dispute open forever while the UI claimed
success).

---

## 2. Stripe artwork checkout — the regression I nearly shipped
**Why:** the original migration dropped the `transactions` INSERT policy. Because
`create-checkout-session` inserts using the **anon key in caller context**, that
would have blocked every Stripe checkout. It now pins the insert to
`status='pending'` instead.

1. As a client, open an artwork with a price.
2. Start a Stripe checkout (the USD path).

- ✅ **Expect:** you reach Stripe's hosted page.
- ❌ **If you get an error before redirect:** the transactions policy is wrong —
  stop and report it.

You don't need to complete payment. If you do, you should return to the artwork
page and see a **"Payment received"** toast (new in this batch — previously the
return was silent).

---

## 3. Upload audio or video artwork — the MIME allowlist
**Why:** my first draft restricted the `artworks` bucket to images only, which
would have broken audio and video artwork. The allowlist now covers
image + audio + video.

1. As an artist, go to artwork upload.
2. Choose **Audio** or **Video** as the type and upload a file under 50 MB.

- ✅ **Expect:** upload completes, byte progress advances, artwork appears.
- ❌ **If rejected with a MIME error:** the file's type isn't in the allowlist —
  send me the exact MIME and I'll add it.

Also try a normal **image** upload (under 15 MB) to confirm that path is intact.

---

## 4. Followers list — proves the email revoke didn't overreach
**Why:** `users.email` was revoked from `anon`/`authenticated`. The
`public_users` view is `security_invoker`, so it reads through the caller's
privileges — if the revoke were too broad, this list would silently empty.

1. Open a profile with followers, or your own followers list.

- ✅ **Expect:** the list populates with names and avatars.
- ❌ **If it's empty or errors:** the column grants are too tight; run
  `docs/DIAGNOSE_EMAIL_GRANT.sql` and send me section A.

---

## 5. Blocking — now enforced by the database
**Why:** `user_blocks` was written but never read, so blocked users could keep
messaging. A trigger now rejects those inserts.

1. Block a user you have an existing conversation with.
2. Try to send them a message.

- ✅ **Expect:** refused, with *"This conversation is unavailable because one of
  you has blocked the other."*
- ❌ **If the message sends:** the trigger isn't firing.

Unblock afterwards to restore the conversation.

---

## Also worth a look while you're in there

Not changed by this migration, but these were fixed earlier in the engagement and
are quick to confirm:

- **Client dashboard loads** — a missing `LogoLoader` import was crashing it on
  every load with a `ReferenceError`.
- **`/trending` in dark mode** — was rendering fully light; should now follow the
  theme.
- **Chat message bubbles** — should show the sender's avatar and name (they were
  reading fields that didn't exist, so both were always blank).
- **Sign up with an email that needs confirmation** — should land on a
  "Check your email" screen rather than a button that spins forever.

---

## Report back

For anything that fails, the useful details are: the exact error text, the
browser console output, and which step. A failure in **1** or **2** matters most —
those are the two paths where a regression would be user-visible immediately.
