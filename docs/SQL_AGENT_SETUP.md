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
