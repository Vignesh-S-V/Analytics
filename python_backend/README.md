# ThreadIQ Python API (migration stage 1)

This FastAPI service establishes the Python API boundary for Ask AI while keeping the current Supabase Edge Function as the secure analytics engine. This is intentional: it preserves existing verified KPI routes, workspace membership checks, per-user quota, read-only SQL validation and streaming response format during the first rollout.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
set SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
uvicorn main:app --host 0.0.0.0 --port 8000
```

Use environment variables only; never place service-role or Gemini secrets in browser code or commit them to the repository.

## Endpoints

- `GET /health`: liveness check only.
- `POST /ask`: validates the origin, bearer-session presence, JSON content type and 16 KB body limit, then streams the current authenticated Supabase Edge Function response through.

The upstream Edge Function still independently verifies the JWT, email confirmation, workspace membership and quota. It remains the authority for read-only SQL and data access.

## Deployment

Deploy as a Python web service on an existing approved free-tier host. Build command: `pip install -r requirements.txt`; start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the host's secret environment settings.

## Migration status

This is a compatibility stage, not a claim that all AI/SQL logic has already been ported from TypeScript. Keep the existing Edge Function deployed until Python deterministic routes, query restrictions, quota checks and regression tests are independently verified. Do not switch the production frontend until the Python service is deployed and smoke-tested.
