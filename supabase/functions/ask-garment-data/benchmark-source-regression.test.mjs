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
