import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateMonthlySeries,
  buildMonthKeys,
  describeSeries,
  forecastGroupedSeries,
  forecastTopDownChild,
  selectForecastModel
} from "./forecasting.js";

test("buildMonthKeys returns inclusive chronological monthly periods", () => {
  assert.deepEqual(buildMonthKeys("2023-11", "2024-02"), [
    "2023-11", "2023-12", "2024-01", "2024-02"
  ]);
});

test("series diagnostics identify smooth and intermittent demand", () => {
  assert.equal(describeSeries(Array(24).fill(100)).demandType, "Smooth");
  const intermittent = Array.from({ length: 24 }, (_, i) => i % 4 === 0 ? 200 : 0);
  assert.equal(describeSeries(intermittent).demandType, "Lumpy");
});

test("model selector returns finite non-negative forecasts and rolling-origin metrics", () => {
  const history = Array.from({ length: 24 }, (_, i) =>
    1000 + i * 15 + [0, 30, 45, 25, 10, -10, -25, -35, -15, 0, 20, 40][i % 12]
  );
  const result = selectForecastModel(history, 3);
  assert.ok(result.model);
  assert.equal(result.forecast.length, 3);
  assert.equal(result.folds, 10);
  assert.ok(result.forecast.every(value => Number.isFinite(value) && value >= 0));
  assert.ok(result.wape >= 0);
  assert.ok(result.candidateScores.length >= 3);
});

test("Croston-compatible forecast handles intermittent positive demand", () => {
  const history = Array.from({ length: 24 }, (_, i) => i % 4 === 0 ? 500 : 0);
  const result = selectForecastModel(history, 6);
  assert.equal(result.profile.demandType, "Lumpy");
  assert.ok(result.forecast.every(value => Number.isFinite(value) && value >= 0));
});

test("top-down group forecast allocates the parent forecast using trailing history share", () => {
  const parent = Array.from({ length: 24 }, (_, i) => 1000 + 10 * i);
  const child = parent.map(value => value * 0.4);
  const result = forecastTopDownChild(child, parent, 6);
  assert.ok(result.model.startsWith("Top-down"));
  assert.ok(Math.abs(result.share - 0.4) < 1e-9);
  assert.equal(result.forecast.length, 6);
  assert.ok(result.forecast.every(value => value >= 0));
});

test("monthly aggregation fills absent group-months with zero and respects product filter", () => {
  const orders = [
    { order_date: "2023-01-15", product_category: "T-Shirt", country: "USA", revenue_inr: 100 },
    { order_date: "2023-03-15", product_category: "T-Shirt", country: "USA", revenue_inr: 200 },
    { order_date: "2023-01-20", product_category: "Polo", country: "UK", revenue_inr: 500 }
  ];
  const result = aggregateMonthlySeries(orders, ["product_category", "country"], "revenue_inr", "T-Shirt");
  assert.deepEqual(result.months, ["2023-01", "2023-02", "2023-03"]);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].series, [100, 0, 200]);
  const forecast = forecastGroupedSeries(result, ["product_category", "country"], 3);
  assert.equal(forecast.length, 1);
  assert.equal(forecast[0].forecast.length, 3);
});
