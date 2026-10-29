# ThreadIQ Python Ask AI API

This FastAPI app contains the Python Ask AI request path: session verification, workspace membership enforcement, per-user quota enforcement, SQL tool-call validation, Gemini tool calling, and source metadata. It uses the same approved Supabase views and read-only SQL RPC as the current Edge Function.

## Required server-side environment

Set these values in the Python host's secret/environment settings. Never add them to .env.example, frontend variables, Git commits, or browser code.

- SUPABASE_URL: Supabase project URL.
- SUPABASE_ANON_KEY: public anon/publishable key used alongside the signed-in user's JWT.
- SUPABASE_SERVICE_ROLE_KEY: server-only key used only for the quota RPC. Never expose it to the browser.
- GEMINI_API_KEY: server-only Gemini key.
- Optional GEMINI_MODEL: defaults to gemini-3.5-flash-lite.
- Optional UPSTREAM_TIMEOUT_SECONDS: HTTP timeout, default 35 seconds.

## Run locally

From the repository root:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r python_backend/requirements.txt
```

Set the environment variables above in your local shell, then run:

```bash
cd python_backend
uvicorn main:app --host 0.0.0.0 --port 8000
python -m unittest -v test_main.py
```

- GET /health: liveness check; returns no configuration or secret data.
- POST /ask: validates origin and request limits, verifies the Supabase JWT and email confirmation, checks threadiq_workspace_members, consumes threadiq_consume_ai_quota, and executes only model-generated read-only SQL against the explicit allowlist through threadiq_run_readonly_query.

## Security controls

- Exact origin allowlist; no wildcard origins.
- Authenticated user's bearer token is used for identity, membership, and data-query RPCs.
- Service-role key is used only for quota enforcement and never sent to the browser.
- Gemini tool calls must pass a strict read-only SQL guard: SELECT/WITH only, no comments/semicolons, and only approved business relations.
- Five SQL tool-call rounds maximum; 16 KB request-body limit; generic error responses avoid leaking secrets and raw database errors.
- Weighted profit margin and rupee conversion guidance are part of the model's system instructions; SQL results remain the evidence source.

## Frontend cutover

The frontend supports VITE_ASK_AI_API_URL as the full endpoint URL, for example https://your-existing-python-host/ask. Set it in the existing frontend build environment only after the Python API has been deployed and smoke-tested. If it is blank, the frontend continues using the current Supabase Edge Function. The current GitHub Pages build does not execute Python, and this repository currently has no dedicated Render service connected to this Python folder. No hosting service was created or repurposed by this change.

## Migration notes

This port replaces the Edge Function's generic Gemini SQL-agent flow, including authentication, membership and quota checks. It does not yet replicate every specialized deterministic shortcut, streaming response, or every legacy response enhancement from the large Edge Function. Keep the Edge Function deployed as a rollback path until Python regression tests and live, authenticated end-to-end checks pass for the supported questions and filters.
