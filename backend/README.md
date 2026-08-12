# Kinetic Authentication Service

FastAPI microservice for enrolling and verifying normalized 63-value hand
signatures with a scikit-learn One-Class SVM.

## Local setup

Python 3.10 or newer is required.

1. Apply the migration in `supabase/migrations` to the Supabase project.
2. Create and activate a Python virtual environment.
3. Install dependencies with `pip install -r backend/requirements.txt`.
4. Set `DATABASE_URL`, `SUPABASE_URL`, a server-side Supabase service-role key
   in `SUPABASE_KEY`, a strong `JWT_SECRET_KEY`, and a separate random
   `ADMIN_ACCESS_TOKEN`.
5. From `backend`, run:

   ```bash
   uvicorn app.main:app --reload --port 8000 --env-file .env
   ```

Interactive API documentation is available at `http://localhost:8000/docs`.
The Next.js frontend is allowed from `http://localhost:3000`.

Successful verification returns an HS256-signed JWT containing `agent_id`,
`clearance_status`, issued-at, issuer, and expiration claims.

Provisioning tokens expire after exactly 15 minutes. The generation request
records the issuing `admin_id` in server logs and writes the signed token to
Supabase. It requires the admin secret in the `X-Admin-Token` header.
Enrollment atomically stores biometric samples and burns the token.
