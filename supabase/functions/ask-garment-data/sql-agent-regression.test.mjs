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
  assert.ok(membership >= 0 && quota > membership && agentCall > quota);
  assert.ok(kpiRoute > 0 && agentCall > kpiRoute);
});

test("History is parsed, passed to SQL agent, and sent by UI", () => {
  assert.match(edge, /body\?\.history/);
  assert.match(edge, /runSqlAgent\(db,agentGeminiKey,question,history,requestedYear,requestedCountry\)/);
  assert.match(frontend, /history:messages\.slice\(1\)/);
});

test("Read-only RPC is invoker-scoped and bounded", () => {
  assert.match(sql, /security invoker/i);
  assert.match(sql, /statement_timeout', '8000'/);
  assert.match(sql, /revoke all on function public\.threadiq_run_readonly_query\(text\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.threadiq_run_readonly_query\(text\) to authenticated/i);
});

test("Current retrieval fallback remains after SQL agent", () => {
  assert.match(edge, /SQL agent failed; (?:using existing retrieval fallback|falling back to current retrieval)/);
  assert.ok(edge.indexOf("const compactRelevance =") > edge.indexOf("const agent = await runSqlAgent"));
});


test("product-specific KPI route runs before multi-intent and company-wide KPI fallbacks", () => {
  const product = edge.indexOf("// Resolve explicit product/fabric requests");
  const multiIntent = edge.indexOf("// Handle multi-intent prompts");
  const companyKpi = edge.indexOf("// Deterministic KPI and country comparison route");
  assert.ok(product > 0 && product < multiIntent && product < companyKpi);
  assert.match(edge, /matchFabricFromQuestion\(question, fabrics\)/);
  assert.match(edge, /resolveFiscalPeriod\(question, requestedYear\)/);
  assert.match(edge, /hasRequestedBusinessMetrics = .*cost\|expenses\|spend/);
  assert.match(edge, /fabric\|gsm\|category/);
  assert.ok(edge.includes("/\\b\\d{2,3}\\s*gsm\\b/i.test(question)"));
  assert.equal(edge.split("Resolve explicit product/fabric requests").length - 1, 1);
  assert.doesNotMatch(edge, /matchedFabrics/);
  assert.match(edge, /\.range\(offset, offset \+ fabricPageSize - 1\)/);
});

test("product specification mismatch returns a clarification instead of company totals", () => {
  const product = edge.indexOf("// Resolve explicit product/fabric requests");
  const multiIntent = edge.indexOf("// Handle multi-intent prompts");
  const route = edge.slice(product, multiIntent);
  assert.match(route, /I have not substituted company-wide figures/);
  assert.match(route, /unavailable: true/);
});

test("product-specific period filter uses inclusive start and exclusive end dates", () => {
  assert.match(edge, /date >= periodFilter\.startDate && date < String\(periodFilter\.endDateExclusive\)/);
});


test("multi-question lowest country ranking uses ascending order and a lowest label", () => {
  const start = edge.indexOf("const wantsLowestRank =");
  const end = edge.indexOf("if (/\\b(?:buyer|buyers|customer|customers)\\b/", start);
  const route = edge.slice(start, end);
  assert.match(route, /wantsLowestRank \? 1 : -1/);
  assert.match(edge, /wantsLowestRank \? "Lowest-ranked result"/);
});;


test("legacy GSM KPI handler is removed; one canonical product route owns variant metrics", () => {
  assert.equal(edge.split("Resolve explicit product/fabric requests").length - 1, 1);
  assert.doesNotMatch(edge, /Product-variant KPI route|asksVariantMetrics/);
});

test("general GP and NP calculations paginate and respect fiscal/dashboard filters", () => {
  const start = edge.indexOf("const asksGrossMetric");
  const end = edge.indexOf("// Exact entity-specific answers must run BEFORE generic KPI intents.", start);
  const route = edge.slice(start, end);
  assert.match(route, /resolveFiscalPeriod\(question,\s*requestedYear\)/);
  assert.match(route, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.doesNotMatch(route, /\.limit\(1000\)/);
});

test("country rankings apply the same fiscal period and selected country filters", () => {
  const start = edge.indexOf("const asksCountryRankingEarly");
  const end = edge.indexOf("const asksProductionRankingEarly", start);
  const route = edge.slice(start, end);
  assert.match(route, /resolveFiscalPeriod\(question,\s*requestedYear\)/);
  assert.match(route, /requestedCountry/);
  assert.match(route, /isLowest\?1:-1/);
});


test("multi-question country ranking uses monthly rows and the requested fiscal period", () => {
  const start = edge.indexOf("const wantsLowestRank =");
  const end = edge.indexOf("if (/\\b(?:buyer|buyers|customer|customers)\\b/", start);
  const route = edge.slice(start, end);
  assert.match(route, /resolveFiscalPeriod\(subQuestion,\s*requestedYear\)/);
  assert.match(route, /monthDate < periodFilter\.startDate \|\| monthDate >= String\(periodFilter\.endDateExclusive\)/);
  assert.match(route, /requestedCountry/);
  assert.match(route, /No country records were found/);
});


test("product-category KPI requests resolve product_category separately from fabric", () => {
  const start = edge.indexOf("// Resolve explicit product-category OR fabric requests");
  const end = edge.indexOf("// Handle multi-intent prompts before any single-intent deterministic route can return.", start);
  const route = edge.slice(start, end);
  assert.match(route, /select\("order_id,product_category,fabric"\)/);
  assert.match(route, /const exactCategory = productCategories\.find/);
  assert.match(route, /categoryMatch\.fabric \? "product_category"/);
  assert.match(route, /query\.ilike\("product_category", selectedProduct\)/);
  assert.match(route, /query\.ilike\("fabric", selectedProduct\)/);
  assert.match(route, /I have not substituted company-wide figures/);
  assert.match(route, /const grossProfit = revenue - directCost/);
});

test("Polo T-Shirt exact phrase can match despite the one-letter T token", () => {
  const start = edge.indexOf("// Resolve explicit product-category OR fabric requests");
  const end = edge.indexOf("// Handle multi-intent prompts before any single-intent deterministic route can return.", start);
  const route = edge.slice(start, end);
  assert.match(route, /fullQuestionNormalized\.includes\(normalizeEntity\(value\)\)/);
  assert.match(route, /const exactCategory = productCategories\.find/);
});
