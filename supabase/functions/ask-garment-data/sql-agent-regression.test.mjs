import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const edgePath = path.join(root, "supabase/functions/ask-garment-data/index.ts");
const frontendPath = path.join(root, "src/main.jsx");
const sqlPath = path.join(root, "sql/threadiq_readonly_agent.sql");
const edge = fs.readFileSync(edgePath, "utf8");
const frontend = fs.readFileSync(frontendPath, "utf8");
const sql = fs.readFileSync(sqlPath, "utf8");

test("SQL agent is behind the existing signed-in membership and quota gates", () => {
  const membership = edge.indexOf('if (membership?.is_active !== true)');
  const quota = edge.indexOf('if (quotaAllowed !== true)');
  const agentCall = edge.indexOf("const agent = await runSqlAgent");
  assert.ok(membership >= 0 && quota >= 0 && agentCall > quota && agentCall > membership);
});

test("SQL agent uses only the approved business relations", () => {
  assert.match(edge, /const allowed = new Set\(\["vw_sales_monthly_by_country"/);
  assert.match(edge, /db\.rpc\("threadiq_run_readonly_query"/);
  assert.match(edge, /async function runSqlAgent/);
});

test("SQL agent falls back to existing retrieval when unavailable", () => {
  assert.match(edge, /SQL agent failed; falling back to current retrieval/);
  assert.ok(edge.indexOf("const compactRelevance =") > edge.indexOf("const agent = await runSqlAgent"));
});

test("Recent Ask AI conversation is sent with the question", () => {
  assert.match(frontend, /history:messages\.slice\(1\)/);
  assert.match(edge, /body\?\.history/);
  assert.match(edge, /runSqlAgent\(db, agentGeminiKey, question, history/);
});

test("SQL RPC is invoker-scoped, bounded and not granted to anon", () => {
  assert.match(sql, /security invoker/i);
  assert.match(sql, /statement_timeout', '8000'/);
  assert.match(sql, /select \* from \(select \* from \(/i);
  assert.match(sql, /revoke all on function public\.threadiq_run_readonly_query\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.threadiq_run_readonly_query\(text\) to authenticated/i);
});
