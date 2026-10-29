# ThreadIQ Analytics — Python-only application

ThreadIQ is a private garment/export business analytics workspace. The active replacement application is a server-rendered Flask/WSGI app in `python_backend/`. The browser receives HTML and CSS only: the new app does not need React, JSX, TypeScript or browser JavaScript.

## Python application modules

- **Overview:** revenue, recorded profit, weighted margin, order counts, delayed orders, monthly trends and country revenue.
- **Ask AI:** natural-language questions grounded in read-only SQL, with source view/row metadata.
- **Product Economics:** product/category/fabric/style sales, cost and profit, including recorded direct fabric + trims + CMT cost per piece.
- **Sales & Buyers:** buyer-level revenue, profit, margin, order quantities and late penalties.
- **Production:** production-line efficiency, rejected quantity, overtime, rework cost and late penalties.
- **Marketing ROI:** spend, inquiry/sample/won-order funnel, attributed value and ROAS.
- **Procurement:** supplier scorecard and market indicators.
- **Investment Lab:** recorded historical return metrics plus a clearly labelled what-if model based on user assumptions.

The interface is server-rendered and works without client-side JavaScript. Voice input, speech playback and client-side chart interactions from the old React UI are not carried over; tables and CSS-based bars are used instead.

## Security

- Supabase Auth validates credentials server-side over HTTPS.
- Email confirmation and active `threadiq_workspace_members` membership are required.
- Membership and the current Supabase session are rechecked on authenticated requests.
- Browser session cookies are HTTP-only, Secure and SameSite=Lax. They contain an opaque session ID, not the access token.
- Forms use CSRF tokens; request bodies are size-limited.
- AI requests consume `threadiq_consume_ai_quota`.
- AI SQL passes the Python read-only validator and explicit relation allowlist in `python_backend/main.py`.
- Read-only queries execute through `threadiq_run_readonly_query` with the signed-in user's JWT.
- Supabase service-role and Gemini API keys must remain server-side. Never place them in Git, HTML or client environment variables.
- No signup flow is exposed; accounts must be approved by the workspace owner.

## Run locally

Python 3.12+ is recommended.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r python_backend/requirements.txt
```

Set these environment variables in your private shell (never commit their values):

- `FLASK_SECRET_KEY`: long, random session-signing secret.
- `SUPABASE_URL`: project URL.
- `SUPABASE_ANON_KEY`: public anon/publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used for quota enforcement.
- `GEMINI_API_KEY`: server-only Gemini key.
- Optional `UPSTREAM_TIMEOUT_SECONDS`.

Run the WSGI application locally:

```bash
cd python_backend
python -m unittest -v
python -m web_app
```

The app listens on `http://127.0.0.1:8000` by default when run directly. `GET /health` returns a non-sensitive liveness response.

## Free hosting without Render

PythonAnywhere is the first candidate because its official free-account allowlist currently includes Supabase domains and `googleapis.com`, which the application needs. Official references:

- [Free-account outbound allowlist](https://www.pythonanywhere.com/whitelist/)
- [PythonAnywhere outbound-network limitations](https://help.pythonanywhere.com/pages/403ForbiddenError/)

Free-tier policies and capacity can change. Hosting has **not** been deployed or live-authenticated yet. Use `python_backend/PYTHONANYWHERE.md` and `python_backend/wsgi.py` for configuration. Add secrets through the host's private web-app environment/WSGI configuration only. Verify login, workspace membership, filters, SQL views, quota rejection and a real AI query before sharing the new URL.

## GitHub Pages migration status

GitHub Pages can only serve static assets; it cannot run this Python WSGI app. The old Pages workflow has been changed to **manual-only rollback** so future pushes do not keep deploying the legacy JavaScript app. The already-published Pages URL may continue showing its previous static build until a Python host is configured and the public link is changed.

Legacy React/Edge Function source remains in the repository temporarily for rollback and comparison; it is not the target runtime. Do not delete that rollback code or cut over the public site until the Python deployment has passed authenticated end-to-end tests.

## Data and formula cautions

- Weighted profit margin = `SUM(profit_inr) / SUM(revenue_inr) * 100`.
- ROAS = attributed order value / marketing spend; it is not profit ROI.
- Supplier association does not prove supplier causation.
- The production line summary does not include month/country columns, so those filters cannot be applied to that view.
- Investment what-if results are based on user-provided assumptions, not an operating forecast.
- If a source view does not expose a field or period, the application must not invent it.
