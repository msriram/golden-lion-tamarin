# Guest play and private interest records

No sign-in, Supabase Auth account, email code, password, or SMTP service is used. Visitors can play as Guest or choose a nickname. Saves and the local leaderboard remain on the device.

## Current installation

Installed November 2, 2026 in the organizer’s configured project. Live public-key checks returned 200 for safe leaderboard reads, 401/42501 for contact reads and private score columns, and 400 for missing outreach consent. Administrator transaction tests confirmed normalized email deduplication, immutable duplicate scores, and withdrawal surviving repeated opt-in. All fixtures were rolled back. A browser honeypot-path check completed without storing a contact or sending email. Website source changes are still local and unpublished.

## Three separate choices

1. **Play:** no email or online record required.
2. **Share a finished result:** explicitly press Share result online in the final report. Only the public nickname and whitelisted result fields are sent. Tutorial practice is separate. Results are unverified client submissions, not authenticated identities or anti-cheat-protected scores.
3. **Stay in the loop:** optionally enter an adult’s own email and affirm both adulthood and permission for Rainforest Rangers to send Tamarin Trails conservation updates, activities, and ways to help. Both boxes start unchecked. Email is not a game identity, saved-game ID, or leaderboard name.

## Database setup

Run `supabase/game.sql` once in the organizer’s Supabase SQL Editor. It creates new objects transactionally and does not drop earlier objects. It is an initial schema, not an idempotent migration.

- `project_interest_contacts`: private, RLS enabled, no read/write privileges for anonymous or authenticated visitors. Trimmed/lowercase email is the unique contact key. This is one record per email string, not proof of identity or ownership. Records include explicit consent, exact consent copy/version, timestamp, source, and `email_verified:false`.
- `game_guest_scores`: public safe-column reads under RLS; no direct insert/update/delete. Campaign UUID is unique. No email, contact ID, account ID, or contact-table relationship is stored with a result.
- `record_project_interest`: narrow insert-only function. Requires adult confirmation and outreach permission. Duplicate emails do nothing and return no existence information. Re-entering a withdrawn email does not resubscribe it.
- `withdraw_project_interest`: suppresses future contact without reading or returning a record. Responses are identical for unknown emails. Anyone knowing an address could suppress it; this is an intentional limitation of an unverified, account-free list and can never enable outreach.
- `record_guest_score`: validates row constraints, appends results, and ignores duplicate campaign IDs. It never overwrites an existing result.

All three entry points use `SECURITY DEFINER` with an empty search path and fixed table references. Default function privileges are revoked before granting only these narrow entry points. Generic Data API writes are denied. Server-side hourly caps are 100 new contacts and 1,000 new results, serialized by advisory locks. Intake has a honeypot. These reduce basic abuse; they do not replace per-client rate limiting, CAPTCHA, moderation, or a server-authoritative game.

Only the configured Supabase project receives requests. The project URL and publishable key are public; never put a secret/service-role key or database password in the website. No Auth API calls or access/refresh tokens are used.

## View interested contacts as the organizer

Use the Supabase dashboard or administrator SQL Editor, never a public website route:

```sql
select email, created_at, consent_version, email_verified
from public.project_interest_contacts
where outreach_status = 'interested'
order by created_at desc;
```

These are **unverified, self-reported expressions of interest**. Do not assume an address belongs to the submitter or identifies a child/player. No messages are sent automatically. Review records before reaching out; respect suppression and use an appropriate confirmed-opt-in/unsubscribe process before bulk mailing. Never export contacts into the repository, public artifacts, leaderboard, or screenshots. Set an organizer-managed retention/deletion process before wider promotion. Withdrawal retains a private suppression entry to prevent accidental re-addition; full erasure needs administrator handling.

Adult confirmation is not age verification or a legal-compliance guarantee. Children should play without submitting their own email.

## Verification

- Public score reads succeed; contact reads, score `select=*`, and generic table writes fail.
- Missing/false consent and invalid email are rejected without a row.
- Case/whitespace normalize; repeated email deduplicates; responses never disclose existence.
- Withdrawal followed by another interest submission never restores outreach permission.
- Scores reject invalid outcome/population combinations, difficulty/version, email-like nicknames, and unsupported values. Tutorials remain separate.
- Sharing a score sends no email; leaving an email sends no score or nickname. Page load and opening the Player panel send no records.
- Guest play works during Supabase outages. Failed requests never claim a successful save.

Test temporary database fixtures inside a transaction ending with `ROLLBACK`. Do not submit real visitor emails or fake persistent scores as test data.

## Official references

- [Database functions and privileges](https://supabase.com/docs/guides/database/functions)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security)
