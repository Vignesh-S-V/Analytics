# Cloudflare Workers deployment (Python / Flask)

This deployment target uses Cloudflare's Python Workers WSGI adapter for the existing Flask server-rendered app. It does not use Render and does not replace the current public site until verified.

## Required GitHub Actions repository secrets

Configure these under **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

- `CLOUDFLARE_API_TOKEN`: token with permission to edit/deploy Workers Scripts for the intended account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `FLASK_SECRET_KEY`: long, random secret (at least 32 random bytes).
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side secret only)
- `GEMINI_API_KEY` (server-side secret only)

Optional secrets: `GEMINI_MODEL`, `UPSTREAM_TIMEOUT_SECONDS`, `ALLOWED_ORIGINS`.

Never commit secrets or paste them into chat. The service-role and Gemini keys must never be sent to the browser.

## Deploy

The GitHub Actions workflow `.github/workflows/cloudflare-python-worker.yml` can be run manually from the Actions tab, or deploy on changes to `python_backend/**` on branch `migration/python-only-web-app`. It skips deployment until both Cloudflare credentials are configured.

After a successful deployment, open the workflow run logs and use the exact `workers.dev` URL printed by Wrangler. Do not assume the URL before deployment.

## Free plan limits and caveats

Cloudflare Workers Free currently allows up to 100,000 requests/day and 10 ms CPU time per invocation. Network waiting is not CPU time, but rendering, imports, and synchronous Python code can hit runtime limitations. Review current limits in the [official docs](https://developers.cloudflare.com/workers/platform/limits/).

## Validation before changing the public URL

1. Confirm the worker responds and sign-in page renders.
2. Test approved user login, invalid login, unconfirmed email, inactive membership and logout.
3. Test dashboard SQL RPC access and each dashboard.
4. Test one fast-path Ask AI query and one Gemini-backed question.
5. Verify session behavior across repeated requests and separate isolates. The current app uses a bounded in-memory session cache; it is not durable across isolate eviction, so production use may require a durable session store before cutover.
6. Check runtime logs and CPU limits.
7. Only after successful authenticated end-to-end tests should the public URL be switched.

The public GitHub Pages URL is not modified by this workflow.
