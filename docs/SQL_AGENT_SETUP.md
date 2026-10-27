# ThreadIQ SQL Agent — Supabase setup

This repo includes the SQL-agent integration for Ask AI. Apply the SQL in Supabase SQL Editor before enabling the agent:

1. Open Supabase Dashboard → SQL Editor.
2. Review that the existing RLS policies permit only approved workspace members to read the intended relations.
3. Execute `sql/threadiq_readonly_agent.sql`.
4. Verify the function is executable only by authenticated users and test with an authenticated workspace session.
5. Deploy the Edge Function: `supabase functions deploy ask-garment-data`.
6. Run `npm test` and `npm run build` before promoting the branch.

Security notes:
- The RPC is SECURITY INVOKER, not SECURITY DEFINER; queries run under the caller role/RLS context.
- It returns at most 500 rows and applies an 8-second statement timeout.
- This is a basic lexical guard, not a full PostgreSQL SQL parser. Review and harden it before production. A keyword filter cannot prove arbitrary SQL is safe. For the strongest isolation, expose narrowly-scoped aggregate RPCs/views instead of arbitrary SQL execution.
- The agent uses only public analytics views and fact_orders described in the Edge Function's schema prompt; do not add service-role credentials to this request path.
- The deployed function must preserve existing authentication, workspace-membership and quota checks.


# SQL agent branch validation notes

The changes are isolated to `feat/sql-agent-analytics`. The SQL agent helper is placed at module scope in `supabase/functions/ask-garment-data/index.ts`, invoked after existing deterministic handlers and after sign-in, membership and quota checks, and before existing retrieval fallback. Frontend `src/main.jsx` now sends the latest six non-streaming turns as context.

Static checks performed through repository reads:
- one `Deno.serve` handler remains;
- SQL agent helper declared before the handler;
- history parsed and passed through;
- membership and quota checks remain before the agent call;
- legacy retrieval fallback remains after the agent call;
- regression test file contains five checks.

Not yet verified in a running environment:
- `npm test` and `npm run build`;
- Supabase SQL migration execution;
- Supabase Edge Function deployment;
- actual Gemini API tool-calling compatibility / live authenticated query behavior.

Before runtime tests, execute `sql/threadiq_readonly_agent.sql` in Supabase SQL Editor after reviewing table RLS. The RPC's lexical filtering is defense-in-depth, not a complete SQL parser. Production-hardening should ideally use narrowly-scoped aggregate functions/views rather than general arbitrary SQL.
