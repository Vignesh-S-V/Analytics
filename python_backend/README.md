# Python-only Analytics application

The main browser-facing app is the server-rendered Flask/WSGI application in `web_app.py`. It provides Overview, Ask AI, Product Economics, Sales & Buyers, Production, Marketing ROI, Procurement and Investment Lab. No browser JavaScript is required.

## Run locally

From the repository root:

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r python_backend/requirements.txt
```

Set `FLASK_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` in your private shell environment. Never commit the values.

```bash
cd python_backend
python -m unittest -v
python -m web_app
```

The Flask app serves the UI on port 8000 by default. `wsgi.py` exports the `application` object for a WSGI host.

## Separate FastAPI AI endpoint

`main.py` also exposes a Python FastAPI endpoint at `POST /ask` for hosts that want a separate AI API process. It validates origin and request size, verifies the Supabase JWT and email confirmation, checks active workspace membership, consumes the AI quota, validates generated SQL against an explicit allowlist, and executes read-only queries with the signed-in user's JWT.

Run it separately only if your hosting topology needs it:

```bash
cd python_backend
uvicorn main:app --host 0.0.0.0 --port 8001
```

The server-rendered Flask UI currently calls the same Python Gemini/SQL engine directly in the server process; it does not call a public browser API endpoint.

## Required server-side secrets

- `FLASK_SECRET_KEY`: long random secret for signed cookies.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: public anon/publishable key used with user sessions.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used for quota enforcement.
- `GEMINI_API_KEY`: server-only Gemini key.
- Optional `GEMINI_MODEL` and `UPSTREAM_TIMEOUT_SECONDS`.

## Security

- Never put service-role or Gemini keys in HTML, browser code, public environment files or Git.
- Do not expose the FastAPI API to untrusted origins; configure its origin allowlist for the actual deployment.
- Authenticated SQL uses the user's bearer token and the approved `threadiq_run_readonly_query` RPC.
- Never replace read-only SQL validation with unrestricted model-generated SQL.
- Test against an approved account before switching public traffic.
