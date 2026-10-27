import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const edge = fs.readFileSync(path.join(root, "supabase/functions/ask-garment-data/index.ts"), "utf8");
const frontend = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
const sql = fs.readFileSync(path.join(root, "sql/threadiq_readonly_agent.sql"), "utf8");

test("SQL agent helper is module-scoped, outside Deno.serve", () => {
  const helper = edge.indexOf("async function runSqlAgent");
  const serve = edge.indexOf("Deno.serve(");
  assert.ok(helper >= 0 && helper < serve);
});

test("SQL agent runs only after membership and quota checks", () => {
  const membership = edge.indexOf('if (membership?.is_active !== true)');
  const quota = edge.indexOf('if (quotaAllowed !== true)');
  const agentCall = edge.indexOf("const agent = await runSqlAgent");
  const kpiRoute = edge.indexOf("// Deterministic KPI and country comparison route");
  const supplierRoute = edge.indexOf("Highest-priority exact route for complete supplier revenue rankings");
  const retrieval = edge.indexOf("const compactRelevance = {");
  assert.ok(membership >= 0 && quota > membership && agentCall > quota);
  assert.ok(kpiRoute > 0 && agentCall > kpiRoute);
  assert.ok(supplierRoute > agentCall && retrieval > supplierRoute);
});

test("History is parsed, passed to SQL agent, and sent by UI", () => {
  assert.match(edge, /body\?\.history/);
  assert.match(edge, /question, history, requestedYear, requestedCountry/);
  assert.match(frontend, /history:messages\.slice\(1\)/);
});

test("Read-only RPC is invoker-scoped and bounded", () => {
  assert.match(sql, /security invoker/i);
  assert.match(sql, /statement_timeout', '8000'/);
  assert.match(sql, /revoke all on function public\.threadiq_run_readonly_query\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.threadiq_run_readonly_query\(text\) to authenticated/i);
});

test("Current retrieval fallback remains after SQL agent", () => {
  assert.match(edge, /SQL agent failed; falling back to current retrieval/);
  assert.ok(edge.indexOf("const compactRelevance =") > edge.indexOf("const agent = await runSqlAgent"));
});
