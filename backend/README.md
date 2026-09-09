# CrimeLens Intelligence API

CrimeLens uses a deliberately separated security and data architecture:

```text
Passkey / WebAuthn
        ↓
Supabase Auth session
        ↓ signed access token
FastAPI authorization and REST API
        ↓
Supabase Postgres investigation records

Liveblocks room ID ──→ collaborative Evidence Board only
```

An authenticated Supabase user UUID, an `investigation_id`, and a Liveblocks
room ID are independent identifiers. An Agent ID is display metadata and cannot
authenticate a request.

## Local setup

From the repository root:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Configure `DATABASE_URL`, `SUPABASE_URL`, and the trusted `CORS_ORIGINS` in
`backend/.env`. JWT issuer and JWKS URLs are derived from `SUPABASE_URL` unless
overridden.

## Database migration

The versioned Supabase migrations create profiles, investigation records,
locations, routes, entities, relationships, timezone-aware timeline events,
facts and junctions, explicit access grants, audit logs, and persistent map
pins. They enable RLS and deny browser roles direct access to authoritative
investigation tables.

```bash
npx supabase db push
```

For a local Supabase stack, use `npx supabase start` followed by
`npx supabase db reset`.

## Seed process

The checked-in JSON seed is generated from the existing, reviewed TypeScript
datasets—not from a separately authored historical reconstruction.

```bash
node --experimental-strip-types backend/scripts/export_seed_data.mjs
backend/.venv/bin/python -m backend.app.db.seed --validate-only
backend/.venv/bin/python -m backend.app.db.seed
```

From inside `backend/`, use `.venv/bin/python -m app.db.seed`.
Seeding is repeatable and replaces only the normalized records for the stable
`demo` and `mumbai-2611` IDs. Validation fails before database writes if an edge
is orphaned, a fact/event reference is invalid, source metadata is missing, or
the Mumbai invariants do not match 10 attackers, five teams, one captured
attacker, 166 killed, and 238 injured.

## Run the API

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Development OpenAPI is at `http://127.0.0.1:8000/docs`. Production docs default
to disabled and can be explicitly controlled with `DOCS_ENABLED`.

## API surface

Public probes:

```text
GET /health
GET /ready
```

Authenticated endpoints:

```text
GET /api/v1/me
GET /api/v1/investigations
GET /api/v1/investigations/{investigation_id}
GET /api/v1/investigations/{investigation_id}/overview
GET /api/v1/investigations/{investigation_id}/map
GET /api/v1/investigations/{investigation_id}/network
GET /api/v1/investigations/{investigation_id}/timeline
GET /api/v1/investigations/{investigation_id}/facts
GET /api/v1/investigations/{investigation_id}/entities/{entity_id}
GET /api/v1/investigations/{investigation_id}/locations/{location_id}
GET|POST /api/v1/investigations/{investigation_id}/workspaces
GET|PATCH|DELETE /api/v1/workspaces/{workspace_id}
POST /api/v1/workspaces/{workspace_id}/path
POST /api/v1/workspaces/{workspace_id}/analyze
GET|PATCH /api/v1/workspaces/{workspace_id}/suggestions[/{suggestion_id}]
GET|PATCH /api/v1/workspaces/{workspace_id}/conflicts[/{conflict_id}]
GET|POST|PATCH|DELETE /api/v1/workspaces/{workspace_id}/questions[/{question_id}]
GET|POST /api/v1/workspaces/{workspace_id}/snapshots
GET|POST /api/v1/workspaces/{workspace_id}/snapshots/{snapshot_id}[/restore]
GET|POST /api/v1/investigations/{investigation_id}/pins
PATCH|DELETE /api/v1/investigations/{investigation_id}/pins/{pin_id}
GET /api/v1/audit/recent
POST|GET /api/v1/investigations/{investigation_id}/evidence
GET /api/v1/evidence/{evidence_id}
POST /api/v1/evidence/{evidence_id}/extract
GET /api/v1/evidence/{evidence_id}/extraction
PATCH /api/v1/evidence/{evidence_id}/candidates/{candidate_id}
POST /api/v1/evidence/{evidence_id}/commit
GET /api/v1/evidence/{evidence_id}/history
GET /api/v1/investigations/{investigation_id}/search?q=
GET /api/v1/investigations/{investigation_id}/activity
GET /api/v1/investigations/{investigation_id}/status
POST /api/v1/investigations/{investigation_id}/reports
```

The final audit route requires a supervisor or administrator role. Every
protected request uses `Authorization: Bearer <Supabase access token>`.

## Frontend connection

Set in the root `.env.local`:

```text
NEXT_PUBLIC_CRIMELENS_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The browser API client retrieves the active Supabase session, places its access
token only in the Authorization header, and hydrates the existing Map, Network,
Timeline, and Ledger data registry. If the API is unavailable, the UI labels the
bundled data as a local fallback and offers retry. It never derives an
investigation ID from the Liveblocks `case` query parameter.

## Tests

```bash
ENVIRONMENT=test backend/.venv/bin/pytest -q backend/tests
npm test
npm run lint
npm run typecheck
npm run build
```

Backend tests cover JWT registered claims and signatures, inactive users,
roles, clearances, investigation authorization, filters, cross-module IDs,
historical invariants, pin ownership inputs, Liveblocks separation, and client
secret exposure.

## Container deployment

```bash
docker build -t crimelens-api backend
docker run --rm -p 8000:8000 --env-file backend/.env crimelens-api
```

The image uses a non-root user, honors `PORT`, exposes a health check, and does
not contain secrets. Configure a real production frontend origin in
`CORS_ORIGINS`; wildcard credentialed CORS is not supported.

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Server-only Supabase Postgres connection |
| `SUPABASE_URL` | Supabase project origin used to derive issuer/JWKS |
| `CORS_ORIGINS` | Comma-separated trusted Next.js origins |
| `ENVIRONMENT` | `development`, `test`, or `production` |

Optional overrides include `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`,
`SUPABASE_JWT_AUDIENCE`, `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL`, `PORT`,
`HISTORICAL_CACHE_SECONDS`, `RATE_LIMIT_PER_MINUTE`, and `DOCS_ENABLED`.
`OPENAI_API_KEY` optionally enables server-side refinement of deterministic
workspace connection candidates; `OPENAI_MODEL` and `OPENAI_TIMEOUT_SECONDS`
control that provider. The API sends only candidate node IDs/types and reason
codes, never grants the provider authority to create case facts or verified
relationships, and falls back to deterministic analysis on any provider error.

## Evidence ingestion pilot

Evidence ingestion stores the original upload separately from derived text,
calculates a SHA-256 file-integrity hash, and emits structured candidates. PDF,
TXT, CSV, JSON, JPEG, and PNG uploads are accepted; images and textless/scanned
PDFs fail extraction safely when no OCR provider is configured. `MAX_UPLOAD_MB`,
`ALLOWED_EVIDENCE_MIME_TYPES`, and `EVIDENCE_STORAGE_DIR` control the bounded
pilot storage path.

The authority boundary is enforced server-side: extraction writes only
`extraction_candidates`; accept/edit/reject updates review state; only the
separate idempotent commit endpoint may write reviewed records into canonical
entities, locations, timeline events, relationships, and facts. The feature is
a pilot and does not claim legal chain-of-custody certification.
