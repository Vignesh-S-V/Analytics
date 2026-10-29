import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateProductGroups,
  detectProductRankingIntent,
  isCountryComparisonQuestion,
  isMultiQuestionPrompt,
  rankBuyerRows,
  splitQuestions,
} from "./analytics-utils.mjs";

test("routes product-group recorded-profit questions to group-level profit ranking", () => {
  assert.deepEqual(detectProductRankingIntent("which product group generated the highest recorded profit"),
    { metric: "profit_inr", asksGroupTotal: true });
});

test("routes explicit sales ranking to revenue, not profit", () => {
  assert.deepEqual(detectProductRankingIntent("rank product groups by total sales"),
    { metric: "revenue_inr", asksGroupTotal: true });
});

test("keeps individual style questions at style level", () => {
  assert.deepEqual(detectProductRankingIntent("rank styles by recorded profit"),
    { metric: "profit_inr", asksGroupTotal: false });
});

test("does not route a general product question as a ranking request", () => {
  assert.equal(detectProductRankingIntent("show product performance"), null);
});

test("aggregates every style and ranks groups by combined recorded profit", () => {
  const result = aggregateProductGroups([
    { product_category: "Shirts", style_id: "S1", revenue_inr: 100, profit_inr: 10 },
    { product_category: "Shirts", style_id: "S2", revenue_inr: 900, profit_inr: 180 },
    { product_category: "Dhotis", style_id: "D1", revenue_inr: 700, profit_inr: 100 },
  ], "profit_inr");
  assert.equal(result[0].product_category, "Shirts");
  assert.equal(result[0].revenue_inr, 1000);
  assert.equal(result[0].profit_inr, 190);
  assert.equal(result[0].style_count, 2);
  assert.equal(result[0].profit_margin_pct, 19);
});

test("uses combined revenue rather than a single style to rank product groups", () => {
  const result = aggregateProductGroups([
    { product_category: "A", style_id: "A1", revenue_inr: 600, profit_inr: 60 },
    { product_category: "A", style_id: "A2", revenue_inr: 600, profit_inr: 60 },
    { product_category: "B", style_id: "B1", revenue_inr: 1000, profit_inr: 250 },
  ], "revenue_inr");
  assert.equal(result[0].product_category, "A");
  assert.equal(result[0].revenue_inr, 1200);
});

test("recalculates weighted margin and does not average style percentages", () => {
  const result = aggregateProductGroups([
    { product_category: "Mixed", style_id: "low", revenue_inr: 900, profit_inr: 90 },
    { product_category: "Mixed", style_id: "high", revenue_inr: 100, profit_inr: 50 },
  ], "profit_inr");
  assert.ok(Math.abs(result[0].profit_margin_pct - 14) < 1e-10);
});

test("handles null, blank, and invalid numeric values without NaN", () => {
  const result = aggregateProductGroups([
    { product_category: "A", style_id: "1", revenue_inr: null, profit_inr: "bad" },
    { product_category: "A", style_id: "2", revenue_inr: "100", profit_inr: "20" },
  ], "profit_inr");
  assert.equal(result[0].revenue_inr, 100);
  assert.equal(result[0].profit_inr, 20);
  assert.equal(result[0].profit_margin_pct, 20);
});

test("country comparison intent requires two countries and a metric", () => {
  assert.equal(isCountryComparisonQuestion("compare revenue in usa vs uae", 2), true);
  assert.equal(isCountryComparisonQuestion("compare revenue in usa", 1), false);
  assert.equal(isCountryComparisonQuestion("compare usa vs uae weather", 2), false);
});

test("recognizes Tamil country-comparison requests", () => {
  assert.equal(isCountryComparisonQuestion("தமிழில் usa மற்றும் germany வருவாய் லாபம் ஆர்டர்கள் ஒப்பிடு", 2), true);
});

test("recognizes category ranking as category aggregation", () => {
  assert.deepEqual(detectProductRankingIntent("rank all available product categories by revenue"),
    { metric: "revenue_inr", asksGroupTotal: true });
  assert.deepEqual(detectProductRankingIntent("identify the product category with the highest recorded profit"),
    { metric: "profit_inr", asksGroupTotal: true });
});

test("keeps profit as the primary metric when follow-up asks whether revenue also leads", () => {
  assert.deepEqual(detectProductRankingIntent("identify the product category with the highest recorded profit; verify the result and state whether it also has highest revenue"),
    { metric: "profit_inr", asksGroupTotal: true });
});

test("keeps revenue as the primary metric when validation mentions profit", () => {
  assert.deepEqual(detectProductRankingIntent("rank all product categories by revenue and state whether the leader also has highest recorded profit"),
    { metric: "revenue_inr", asksGroupTotal: true });
});

test("splits multiple questions on one line and preserves all parts", () => {
  assert.deepEqual(splitQuestions("Which country has the highest revenue? Which buyer gives the highest profit? Show monthly sales growth."),
    ["Which country has the highest revenue?", "Which buyer gives the highest profit?", "Show monthly sales growth?"]);
});

test("splits newline-delimited questions and strips bullet/number prefixes", () => {
  assert.deepEqual(splitQuestions("1. Total revenue?\n2. Total profit?\n- Compare 2024 vs 2023 revenue."),
    ["Total revenue?", "Total profit?", "Compare 2024 vs 2023 revenue?"]);
  assert.equal(isMultiQuestionPrompt("Total revenue?\nTotal profit?"), true);
});

test("keeps a single normal prompt intact", () => {
  assert.deepEqual(splitQuestions("Why did profit decrease in 2024?"), ["Why did profit decrease in 2024?"]);
  assert.equal(isMultiQuestionPrompt("Why did profit decrease in 2024?"), false);
});

test("ranks buyer records by the requested metric, not the other metric", () => {
  const rows = [
    { buyer_name: "A", revenue_inr: 1000, profit_inr: 50 },
    { buyer_name: "B", revenue_inr: 700, profit_inr: 200 },
  ];
  assert.equal(rankBuyerRows(rows, "profit_inr")[0].buyer_name, "B");
  assert.equal(rankBuyerRows(rows, "revenue_inr")[0].buyer_name, "A");
});

test("rejects unsupported buyer ranking metrics", () => {
  assert.throws(() => rankBuyerRows([], "order_count"), /metric must be/);
});
