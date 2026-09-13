# Public entry and private investigations

Implemented locally for CrimeLens2 / The Fatal Ledger. No hosted database migrations,
seed runs, room updates, credential changes, commits, pushes, PRs or deployments were performed.
Existing uncommitted gap-reconstruction and workspace/UI changes were preserved.

## User journey

- `/` is the public archive in development and production. Three physical folders use CSS
  perspective and user-controlled rotation/opening. Direct links bypass the animation.
  Previews use the bundled fictional graph and Mumbai timeline; the private preview is empty.
- `/demo/demo` and `/demo/mumbai-2611` render only those explicitly allowlisted bundled
  datasets through the original `InvestigationWorkspace` shell and its original map,
  evidence board, authoritative graph, timeline, fact ledger, toolbars and responsive
  navigation. Unknown IDs return 404. A capability provider makes the shared rendering
  components read only for guests. These pages do not mount the authenticated data runtime,
  evidence intake, private case hydration or any Liveblocks provider/room connection.
  Guest state is initialized from the bundled dataset and restored on unmount without using
  authenticated or legacy workspace storage keys.
- Email signup uses the installed Supabase `signInWithOtp` with `shouldCreateUser: true`.
  It registers new accounts and signs existing accounts in without duplicating them.
  The form reports a verification-link request only after Supabase accepts it.
- `/enroll?next=...` resolves the verified session, provisions the eligible public profile
  through an RPC, then uses the existing Supabase passkey enrollment mechanism. Existing
  passkey sign-in and management remain available. An email session can continue if the
  authenticator is unsupported or cancelled. All return paths are internal and allowlisted.
- `/cases` lists server-authorized investigations. `/cases/new` creates a private case using
  an owner-scoped retry key. `/workspace?investigation=ID` verifies identity, profile and case
  loading before rendering. No development bypass or private-to-demo fallback remains.
- The existing Map, Timeline, Evidence intake, Evidence Board and custom Network views operate
  on the new case. Case creation initializes no fictional evidence or relationships.

## Required operator configuration (not performed)

1. Review and apply `supabase/migrations/20260910010000_public_onboarding_private_cases.sql`
   **after the existing migrations** through your normal migration process. Do not reset or
   reseed either demo. This migration adds owner/retry fields, a public-account flag, a
   registration marker and trusted onboarding functions. It removes the obsolete two-case pin
   constraint while retaining the investigation foreign key. Existing profile values are
   unchanged. Existing users are not backfilled into public registration.
2. Supabase Authentication: enable public signup and the Email provider; keep **Confirm email**
   enabled. Configure production SMTP, sender identity and delivery limits. The code does not
   bypass email verification, rate limits or CAPTCHA policies. If CAPTCHA is enabled, supply
   its frontend integration before enabling public signup on that project.
3. Set the Supabase Site URL and `NEXT_PUBLIC_SITE_URL` to the same stable HTTPS origin.
   Allowlist `/enroll` and the callback's `next` query. For the local site, allow
   `http://127.0.0.1:3000/enroll` and `http://127.0.0.1:3000/enroll?next=**` (and equivalent
   localhost entries if used). For production use your exact hostname with `/enroll` and
   `/enroll?next=**`, not a wildcard hostname. Keep the normal Supabase magic-link template
   using `{{ .ConfirmationURL }}`. The SDK detects the implicit session callback.
4. Preserve the existing Supabase passkey RP ID and origins. Enable passkeys if not already
   enabled; add the stable HTTPS frontend origin without changing legitimate credentials.
5. Configure the frontend Supabase publishable URL/key and FastAPI URL, and the backend
   database/JWKS settings and exact frontend CORS origins from the example env files.
6. For private collaboration, create/use a **separate Liveblocks project** from the existing
   public-key project. Disable public authentication there. Keep its default room access empty;
   do not provision wildcard room grants. Set `LIVEBLOCKS_PRIVATE_SECRET_KEY` only on FastAPI,
   and set `LIVEBLOCKS_PRIVATE_PROJECT_ISOLATED=true` only after checking isolation and public
   authentication settings. Then enable `NEXT_PUBLIC_PRIVATE_COLLABORATION_ENABLED=true`.
   The legacy public key cannot authenticate to this separate project. No legacy room is
   renamed, migrated or overwritten. Until configured, private Evidence Board work is explicitly
   temporary; authenticated custom graph persistence remains independent and available.
7. Explicit sharing is represented by trusted `investigation_access` rows; no public invitation
   endpoint was introduced. The owner is inserted atomically at creation. A trusted admin may
   grant case membership. For collaboration, `owner`, `editor` and `investigator` memberships
   receive write permission; other memberships receive read permission. Never expose membership
   table writes directly to browser roles.

Private room authorization uses the verified Supabase JWT, active profile, exact case/room
mapping and explicit membership before requesting an exact-room token from the
[Liveblocks authorization API](https://liveblocks.io/docs/api-reference/rest-api-endpoints).
Secret-project isolation is an operator prerequisite, not something a random room ID can provide.
Only the Evidence Board has live synchronization. Custom network graphs use authorized REST saves.

## Authorization and persistence

Public users receive `investigator`, `standard`, `active=true`, `public_account=true` only through
`complete_public_onboarding()`. It requires an `auth.uid()` whose server registration marker exists
and whose email is confirmed. Metadata supplies a bounded display name only. Privileged fields
remain server-controlled. Existing profiles are never overwritten (`ON CONFLICT DO NOTHING`).

Public accounts require explicit membership even when their clearance would otherwise permit
access. Every newly created private case requires membership for all users, including high-clearance
legacy users. Existing users retain their previous access rules for existing investigations.
Case creation uses a server UUID for the investigation, a separate UUID-based room ID and an atomic
owner/retry-key constraint plus transaction lock. Different request contents cannot reuse a key.

Custom graph operations reuse the existing owner-scoped backend; case access is also rechecked
for reads, mutations and deletion. Duplicating a graph remaps internal record IDs while preserving
references to authoritative case records. Saves are serialized, cover all changed workspaces,
and check the initiating account before sending. Failures are visible and retryable.

New cache keys are `crimelens-network-workspaces:v2:USER:CASE`; the old
`crimelens-network-workspaces:CASE` keys and their contents are untouched and never silently
assigned to a new account. Legacy local graphs are not automatically imported. Server workspaces
remain accessible to their owners. Cache data does not authorize access or substitute for a
failed server load. Account changes unmount workspaces and clear private registry/Zustand state.

## Verification and limits

Baseline: 32 frontend tests, 71 backend tests and TypeScript passed.
Current checks and browser results are recorded in the completion response. Added tests exercise
public allowlisting, destination validation, trusted onboarding success/failure, cache isolation,
duplication, private case creation/retry, evidence ingestion/commit, cross-user denial and room
authorization. Existing canonical TypeScript datasets and the backend seed JSON have no diff.

Headless Chrome checks cover desktop/mobile, both themes, rotation/opening, stable form geometry
and values, keyboard navigation, reduced motion, simulated email success/rate limiting, both guest
demos, no guest protected-service calls, unknown-demo 404 and unauthenticated private redirects.
Screenshots were inspected locally. The original CARTO styles and tiles returned successfully in
both themes; map tiles still require their existing external providers. The fictional case uses
the existing bundled board snapshot. No approved Mumbai board snapshot exists in the repository,
so that board explicitly directs guests to the approved Fact Ledger and Case Sources instead of
connecting to a room, inventing content or silently displaying an empty canvas.

The default Turbopack production build hit an environment subprocess-port error. The supported
`npm run build -- --webpack` production build passes, including static generation and type checking.
The SQL migration was prepared but not executed against PostgreSQL; backend behavioral tests use
the existing memory repository. Real SMTP delivery, an actual Supabase passkey ceremony, and a
connection to the isolated Liveblocks project have **not** been verified end to end.

## Main files

- Entry/demo UI: `app/page.tsx`, `app/demo/[id]/page.tsx`, `components/public-entry.tsx`,
  `components/investigation-workspace.tsx`, `components/investigation-access.tsx`,
  `components/public-case-sources.tsx`, `app/globals.css`.
- Onboarding/cases: `app/cases/**`, `components/private-cases.tsx`,
  `components/authenticated-workspace.tsx`, `components/security-terminal.tsx`,
  `components/passkey-terminal.tsx`, `lib/crimelens-auth.ts`, `lib/public-access.ts`.
- Private API: `backend/app/services/private_cases.py`, investigation/evidence/workspace routes,
  permissions/dependencies, profile/investigation schemas, repository and pins router.
- Collaboration: `backend/app/api/routes/collaboration.py`, `lib/liveblocks.tsx`, Liveblocks runtime,
  authenticated uplink and QR links, backend settings and example env files.
- Workspaces: custom network persistence, `lib/network-workspace-persistence.ts`, API client,
  investigation registry/store/switcher and private timeline guard.
- Tests: `backend/tests/test_private_cases.py`, `lib/public-access.test.ts`, updated room-contract
  test, `vitest.config.ts`.
