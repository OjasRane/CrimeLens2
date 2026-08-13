# CrimeLens Intelligence API

FastAPI serves authenticated investigation endpoints. Supabase Auth is the
identity and session authority; requests must carry a valid Supabase access
token and the authenticated user must have an active `public.profiles` row.

## Setup

1. Create a virtual environment and install `requirements.txt`.
2. Copy `.env.example` to `.env`.
3. Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, and
   `CORS_ORIGINS`.
4. Apply both Supabase migrations, including
   `20260813010000_create_investigation_pins.sql`.
5. Start the API:

```bash
uvicorn app.main:app --reload
```

The health endpoint is public. Intelligence and profile endpoints validate the
Supabase bearer token and active CrimeLens authorization profile.

## Investigation pin endpoints

All pin routes require a verified Supabase bearer token and an active profile:

```text
GET    /api/v1/cases/{case_id}/pins
POST   /api/v1/cases/{case_id}/pins
PATCH  /api/v1/cases/{case_id}/pins/{pin_id}
DELETE /api/v1/cases/{case_id}/pins/{pin_id}
```

The server derives `created_by` from the token, scopes every query by case,
validates linked entity IDs against that case, blocks read-only roles from
mutations, and permits edit/delete only for the pin owner or a case admin.
Create, update, and delete snapshots are recorded in
`public.investigation_pin_events`.
