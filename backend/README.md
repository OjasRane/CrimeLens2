# CrimeLens Intelligence API

FastAPI serves authenticated investigation endpoints. Supabase Auth is the
identity and session authority; requests must carry a valid Supabase access
token and the authenticated user must have an active `public.profiles` row.

## Setup

1. Create a virtual environment and install `requirements.txt`.
2. Copy `.env.example` to `.env`.
3. Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, and
   `CORS_ORIGINS`.
4. Start the API:

```bash
uvicorn app.main:app --reload
```

The health endpoint is public. Intelligence and profile endpoints validate the
Supabase bearer token and active CrimeLens authorization profile.
