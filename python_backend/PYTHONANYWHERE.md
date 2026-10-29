# Python-only web app on PythonAnywhere (free-tier candidate)

This WSGI app is a server-rendered Python alternative to the React/Vite UI. It does not execute browser JavaScript or TypeScript. The previous frontend source has been removed from this branch. The old public Pages artifact and remotely deployed Supabase Edge Function may still exist until the Python deployment is verified and the public URL is changed.

## Hosting decision

PythonAnywhere is the first no-Render option to evaluate. Its free accounts support hosted Python web apps, but outbound network access is restricted to its allowlist. The current allowlist includes `.supabase.co` / `.supabase.com` and `.googleapis.com`, which are needed for Supabase and the Gemini REST API. Provider policies and limits can change; verify live authentication and AI requests on the actual account before switching users.

Free hosting is not a guarantee of uninterrupted uptime or unlimited usage. Do not move production traffic until smoke tests pass.

## App configuration

The PythonAnywhere WSGI file must import this app:

```python
import os
import sys

project_path = "/home/YOUR_USERNAME/Analytics/python_backend"
if project_path not in sys.path:
    sys.path.insert(0, project_path)

# Configure these values in the host's private WSGI configuration, never in Git.
os.environ["FLASK_SECRET_KEY"] = "REPLACE_WITH_A_LONG_RANDOM_SECRET"
os.environ["SUPABASE_URL"] = "https://YOUR_PROJECT.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "YOUR_PUBLIC_ANON_KEY"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "YOUR_SERVER_ONLY_SERVICE_ROLE_KEY"
os.environ["GEMINI_API_KEY"] = "YOUR_SERVER_ONLY_GEMINI_KEY"

from web_app import app as application
```

Keep this WSGI file private and never commit it. A service-role key and Gemini API key must only exist on the server. Do not set either in HTML, browser storage, a public environment file, or a GitHub Pages build.

Install dependencies in a PythonAnywhere Bash console:

```bash
cd ~/Analytics
python -m pip install --user -r python_backend/requirements.txt
```

Set the web app's source directory to the repository clone and configure the WSGI file path above. Reload the web app after changing the WSGI file.

## Security behavior

- Supabase password sign-in is performed server-side over HTTPS.
- Email confirmation and active `threadiq_workspace_members` membership are checked before access.
- The browser cookie stores only an opaque random session ID; access tokens stay in a bounded, expiring server-side cache.
- The read-only SQL RPC receives the signed-in user's JWT.
- AI calls consume the existing quota RPC and use the existing SQL allowlist/validator.
- Secrets are never returned to templates or browser code.
- Sign-out removes the server-side session entry.

## Required verification before production cutover

1. Confirm the provider account can install Flask, requests, httpx and cachetools.
2. Test login with an approved user and a non-member user.
3. Test unconfirmed email, invalid credentials, sign-out and session expiry.
4. Verify the dashboard SQL RPC works with the user's JWT and existing RLS/security policy.
5. Verify quota rejection and one successful AI query; inspect server logs for exceptions without printing tokens or secrets.
6. Check filters, totals and all key questions against the existing dashboard.
7. Confirm the provider's outbound network policy and free-tier limits still permit Supabase and Gemini calls.
8. Only after parity and security checks pass should the public link be switched.

## Migration status and cutover checklist

The Python UI includes Overview, Ask AI, Product Economics, Sales & Buyers, Production, Marketing ROI, Procurement and Investment Lab. It uses server-rendered HTML/CSS without browser JavaScript. The previous React source is available only in Git history; GitHub Pages cannot run Python. The previously published static artifact can continue to be served, but this branch no longer builds or deploys it.

Before sharing the Python host URL or changing the public website, test every page against the real workspace and compare totals with the legacy dashboard. Verify login, email confirmation, revoked membership, SQL permissions, CSRF protection, AI quota rejection, country/year filters, and at least one authenticated AI query. The public GitHub Pages URL has not been switched by this PR because no hosting account was provisioned and no authenticated live test has been run.
