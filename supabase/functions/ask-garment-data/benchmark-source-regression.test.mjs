import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("./index.ts", import.meta.url),
  "utf8",
);

test("country margin differences use percentage points, not percent", () => {
  assert.match(source, /key === "margin" \? Math\.abs\(difference\)\.toFixed\(2\) \+ " percentage points"/);
});

test("marketing ROAS aggregation paginates beyond Supabase's default row cap", () => {
  assert.match(source, /const pageSize = 1000;[\s\S]{0,700}\.range\(offset,offset\+pageSize-1\)/);
  assert.match(source, /if\(pageRows\.length < pageSize\) break;/);
  assert.match(source, /\.order\("month",\{ascending:true\}\)\.order\("country",\{ascending:true\}\)\.order\("channel",\{ascending:true\}\)/);
  assert.match(source, /Could not read complete marketing aggregates from Supabase/);
});

test("three-area investigation request uses deterministic complete-view rankings", () => {
  assert.match(source, /three business areas\|business areas worth investigating\|identify\.\{0,40\}business areas/);
  assert.match(source, /\.order\("rework_cost_inr", \{ ascending: false, nullsFirst: false \}\)/);
  assert.match(source, /\.order\("late_penalty_inr", \{ ascending: false, nullsFirst: false \}\)/);
  assert.match(source, /This line was selected by rework cost, not by overtime/);
  assert.match(source, /complete buyer view; sorted by recorded late penalties/);
});

test("monthly-average wording does not bypass deterministic average-revenue KPI routing", () => {
  assert.match(source, /average revenue per order\\|average revenue/);
  assert.ok(
    source.includes("category|month|trend|forecast"),
    "the core KPI exclusion must retain month-specific intent but not the word monthly",
  );
  assert.ok(
    !source.includes("category|month|monthly|trend|forecast"),
    "the broad monthly exclusion must not bypass average-revenue questions",
  );
});

test("average revenue per distinct order displays precise rupee value rather than rounded lakh abbreviation", () => {
  assert.match(source, /Average revenue per distinct order = [\s\S]{0,220}all\.averageOrderRevenue\.toLocaleString\("en-IN", \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/);
});


test("Tamil average revenue per distinct order also displays precise rupee value", () => {
  assert.match(source, /ஒரு தனித்த ஆர்டருக்கான சராசரி வருவாய்[\s\S]{0,260}all\.averageOrderRevenue\.toLocaleString\("en-IN", \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\)/);
});


test("weighted margin questions explain weighted versus simple-average margin", () => {
  assert.match(source, /marginDifferenceExplanation/);
  assert.match(source, /each order is weighted by its revenue/);
});

test("reconciliation questions compare revenue minus cost with recorded profit", () => {
  assert.match(source, /reconciliationExplanation/);
  assert.match(source, /revenue .* − cost .* = .*recorded profit/);
});

test("monthly trend answers include all returned months in chronological order", () => {
  assert.match(source, /const monthlyTable = points\.map/);
  assert.match(source, /Month-by-month values in chronological order/);
});

test("production ranking answers disclose unavailable delayed-shipment evidence", () => {
  assert.match(source, /Delayed-shipment counts are unavailable in vw_production_by_line/);
  assert.match(source, /delayed shipments\?/);
});

test("training evidence question directly states that RLHF/fine-tuning/custom-transformer evidence is unavailable", () => {
  assert.match(source, /No verified implementation evidence was found here for RLHF training or a custom transformer model/);
  assert.match(source, /whether RLHF, fine-tuning, or a custom transformer was used is unavailable/);
});


test("workspace-specific LLM answers use a strict retrieved-evidence gate", () => {
  assert.match(source, /STRICT DATA GATE/);
  assert.match(source, /use only retrieved Supabase evidence/);
  assert.match(source, /I do not have enough information to answer this/);
  assert.match(source, /Do not invent or guess missing values/);
});

test("strict business-data fallback does not block general conceptual answers", () => {
  assert.match(source, /General conceptual questions may use general knowledge/);
});


test("SQL agent exposes the complete management monthly view and its approved relation allowlist", () => {
  assert.match(source, /vw_management_monthly\(month, order_count, revenue_inr, total_cost_inr, profit_inr/);
  assert.match(source, /"vw_market_monthly","vw_management_monthly","fact_orders"/);
});

test("Ask AI SQL guidance covers buyer-profit rankings, monthly growth, and evidence-based profit drivers", () => {
  assert.match(source, /which buyer gives the highest profit/);
  assert.match(source, /For monthly growth, aggregate the requested metric by month/);
  assert.match(source, /For "why did profit decrease\?"/);
  assert.match(source, /Report measured contributors, not unsupported causal claims/);
});

test("deterministic core KPI route respects explicit periods and selected country/year filters", () => {
  assert.match(source, /const explicitYears = \[\.\.\.new Set\(\[\.\.\.normalizedKpiQ\.matchAll/);
  assert.match(source, /requestedYear/);
  assert.match(source, /const scopeCountry = asksAllTime \? "" : \(explicitCountry \|\| requestedCountry\)/);
  assert.match(source, /No matching order records were found/);
  assert.match(source, /this does not mean the metric is zero/);
});


test("annual peak-month route requires explicit highest-revenue-month intent", () => {
  assert.match(source, /highest\[- \]revenue month/);
  assert.match(source, /month with the highest revenue/);
  assert.match(source, /month had the highest revenue/);
  assert.match(source, /Do not let a[\s\S]{0,100}hijack all other intents/);
});


test('buyer ranking honors highest-profit intent and does not hijack multi-question prompts', () => {
  assert.ok(source.includes('const isMultiQuestionPrompt ='));
  assert.ok(source.includes('const asksProfitRanking ='));
  assert.ok(source.includes('const metric = asksProfitRanking ? "profit_inr" : "revenue_inr"'));
  assert.ok(source.includes('!isMultiQuestionPrompt'));
});


test("single-answer country revenue question returns only the highest-revenue country", () => {
  assert.match(source, /if \(\/which country\.\*highest revenue/);
  assert.match(source, /from\("vw_sales_by_country"\)[\s\S]{0,220}\.order\("revenue_inr", \{ ascending: false \}\)\.limit\(1\)/);
  assert.match(source, /single highest-revenue country selected by descending revenue_inr/);
});

test("single-answer buyer profit question returns only the highest-profit buyer", () => {
  assert.match(source, /if \(\/which buyer\.\*highest profit/);
  assert.match(source, /from\("vw_sales_by_buyer"\)[\s\S]{0,260}\.order\("profit_inr", \{ ascending: false \}\)\.limit\(1\)/);
  assert.match(source, /single highest recorded-profit buyer selected by descending profit_inr/);
});


test("singular leader questions resolve before cached ranking/RAG paths", () => {
  assert.match(source, /const leaderIsMulti =/);
  assert.match(source, /const explicitMultiRow =/);
  assert.match(source, /singleCountryLeader/);
  assert.match(source, /singleBuyerProfitLeader/);
  assert.match(source, /tanglishBuyerProfitLeader/);
  assert.match(source, /\.order\("revenue_inr", \{ ascending: false, nullsFirst: false \}\)\.limit\(1\)/);
  assert.match(source, /\.order\(buyerMetric, \{ ascending: false, nullsFirst: false \}\)\.limit\(1\)/);
});

test("explicit multi-row ranking and multi-question prompts do not use singular leader response", () => {
  assert.ok(source.includes("const explicitMultiRow = /\\b"));
  assert.match(source, /!leaderIsMulti && !explicitMultiRow/);
});

test("Top-N buyer ranking applies the requested row limit while list-all remains complete", () => {
  assert.ok(source.includes("const topNMatch = normalizedQ.match(/\\btop\\s+(\\d{1,3})\\b/i);"));
  assert.match(source, /const requestedTopN = topNMatch \? Math\.max\(1, Math\.min\(100, Number\(topNMatch\[1\]\)\)\) : null/);
  assert.match(source, /const rowLimit = requestedTopN \?\? 100/);
  assert.match(source, /\.order\(metric, \{ ascending: false, nullsFirst: false \}\)\.limit\(rowLimit\)/);
  assert.match(source, /\.slice\(0, requestedTopN \?\? rows\.length\)/);
  assert.match(source, /requestedTopN\?"Top "\+ranked\.length\+" buyers by "/);
  assert.match(source, /requestedTopN\?"top "\+ranked\.length\+" buyer groups sorted by requested metric":"complete buyer groups sorted by requested metric"/);
});


test("explicit multi-year comparisons calculate both years and year-over-year changes", () => {
  assert.match(source, /if \(asksComparison && explicitYears\.length >= 2/);
  assert.match(source, /factRows\.filter\(r => txt\(r\.order_date\)\.slice\(0, 4\) === year\)/);
  assert.match(source, /recorded profit .*growth\(last\.profit, first\.profit\)/);
  assert.match(source, /Margin change:/);
});

test("country Top-N ranking returns only the requested number of countries", () => {
  assert.ok(source.includes(String.raw`const topNMatch=normalizedQ.match(/\btop\s+(\d{1,2})\b/i);`));
  assert.match(source, /const displayed=ranked\.slice\(0,requestedTopN\)/);
  assert.ok(source.includes('" · showing "+displayed.length+" of "+ranked.length+" countries"'));
});

test("single highest-revenue buyer question returns one buyer instead of a full ranking", () => {
  assert.match(source, /const singleBuyerRevenueLeader =/);
  assert.match(source, /if \(singleBuyerProfitLeader \|\| tanglishBuyerProfitLeader \|\| singleBuyerRevenueLeader\)/);
  assert.match(source, /order\(buyerMetric, \{ ascending: false, nullsFirst: false \}\)\.limit\(1\)/);
});

test("singular product-group leader question returns a concise single answer", () => {
  assert.match(source, /const isSingleProductGroupLeader =/);
  assert.match(source, /if \(isSingleProductGroupLeader\) return respond/);
});

test("singular production-line question returns one line while Top-N limits table rows", () => {
  assert.match(source, /const isSingleProductionLeader=/);
  assert.match(source, /const productionDisplayRows=isSingleProductionLeader\?ranked\.slice\(0,1\)/);
  assert.match(source, /rows:productionDisplayRows\.map/);
});


test("short highest-revenue buyer prompts return exactly one row", () => {
  assert.match(source, /const singleBuyerLeader = !requestedTopN && !explicitMultiRow/);
  assert.match(source, /const rowLimit = requestedTopN \?\? \(singleBuyerLeader \? 1 : 100\)/);
});

test("short highest-profit product-group prompts return one group", () => {
  assert.ok(source.includes('const isSingleProductGroupLeader = /\\b(?:highest|most|top|best)\\b/i.test(normalizedQ) && !explicitMultiRow;'));
});

test("short highest rework-cost production-line prompts return one line", () => {
  assert.ok(source.includes('const isSingleProductionLeader=/\\b(?:highest|lowest|most|least|best|worst)\\b/.test(normalizedQ)&&!explicitMultiRow;'));
});
