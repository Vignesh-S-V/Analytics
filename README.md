# ThreadIQ — Tirupur Garment Business Intelligence

A free-tier-first React/Vite dashboard and Ask AI analytics workflow for garment/export business operations.

## Current status (audited 2026-10-21)

This repository has deterministic analytics routes in the Supabase Edge Function `ask-garment-data`, alongside a retrieval/LLM response path for questions that are not handled by a specific deterministic route.

- GitHub PR [#43 — Fix benchmark insight accuracy and source completeness](https://github.com/Vignesh-S-V/Analytics/pull/43) is merged into `main`.
- Supabase Edge Function `ask-garment-data` was confirmed **ACTIVE, version 69** during the audit.
- The production database was queried read-only to reconcile the core sales totals.
- The full authenticated 30-question production benchmark has **not** been completed; an approved signed-in workspace session is required. Do not interpret the sample outputs below as proof that every possible question is correct.
- A README update does not deploy or change the Edge Function.

## Verified data snapshot

Read-only SQL returned the following values for the current workspace data:

| Metric | Verified value |
|---|---:|
| Raw `fact_orders` rows | 10,000 |
| Distinct order IDs | 10,000 |
| Total revenue | ₹6,998,511,331 (about ₹699.85 Cr) |
| Total recorded cost | ₹6,021,538,834 (about ₹602.15 Cr) |
| Total recorded profit | ₹976,972,497 (about ₹97.70 Cr) |
| Weighted profit margin | 13.96% |
| Revenue − cost − recorded profit | ₹0 |
| `vw_sales_monthly_by_country` rows | 288 |
| Monthly periods currently present | 2023-01 through 2024-12 (24 distinct months) |

**Core formulas**

- Weighted profit margin = `SUM(profit_inr) / SUM(revenue_inr) * 100`
- Average revenue per distinct order = `SUM(revenue_inr) / COUNT(DISTINCT order_id)`
- Reconciliation difference = `SUM(revenue_inr) - SUM(total_cost_inr) - SUM(profit_inr)`

The raw fact table and monthly-by-country view returned matching overall revenue, cost, profit and order totals. The 2025 monthly revenue questions currently return unavailable because the monthly view contains no 2025 records. Re-check coverage after new data is loaded.

### Other source-view counts checked

These are row counts for different aggregate views; they must not be added together as unique orders.

| Source view | Rows |
|---|---:|
| `vw_sales_by_country` | 12 |
| `vw_sales_by_buyer` | 40 |
| `vw_sales_by_product` | 150 |
| `vw_marketing_channel_performance` | 1,152 |
| `vw_production_by_line` | 20 |
| `vw_supplier_scorecard` | 20 |
| `vw_market_monthly` | 24 |

## Implemented controls and improvements

The following controls were verified in the Edge Function source or in the merged PR:

- Signed-in user/session validation, workspace membership checks and per-user request quota.
- Request content-type and body-size checks, plus an explicit CORS origin allow-list.
- Deterministic core KPI calculations over paginated `fact_orders` rows.
- Distinct order ID counting, weighted margin formula, average revenue formula and revenue/cost/profit reconciliation.
- Country comparison calculations and margin differences expressed in **percentage points**.
- Monthly data coverage checks, exact month-key checks and no invented revenue for unavailable periods.
- Marketing view pagination beyond Supabase's default response cap, with deterministic ordering by month, country and channel in the current `main` source.
- Deterministic business-area investigation routes that rank supplier penalties, production rework and buyer penalties separately, with cautions against inferring causation.
- Source names and row counts returned for supported deterministic routes.
- Regression checks in `supabase/functions/ask-garment-data/benchmark-source-regression.test.mjs`.

## Audit findings — improvements still recommended

These are **not claimed as completed**. Prioritize them before treating Ask AI as fully benchmarked.

1. **Average-revenue intent routing:** The supplied sample for “average revenue per distinct order” returned only total revenue and order count. Ensure phrases such as “average revenue”, “per distinct order”, and “do not average monthly averages” route to the deterministic KPI calculation and visibly return the calculated value and formula.
2. **Training / model-evidence intent:** Questions about RLHF, fine-tuning or a custom transformer should get a concise evidence-based answer. If repository evidence does not establish those details, say that they cannot be verified; do not repeat unrelated sales metrics.
3. **Source attribution:** Show the source actually used, filters applied, rows checked, aggregation grain and calculation method. Do not label a result as raw-order verified when it was calculated from an aggregate view.
4. **Product grain:** Keep product category, product group, fabric and style distinct. The returned ranking title and aggregation must match the grain the user requested.
5. **Generic retrieval limits:** Several generic retrieval queries use finite limits (for example 100, 200, 1,000 or 2,000 rows). For complete rankings or totals, use deterministic server-side aggregation/pagination; if a result is partial, disclose that limitation.
6. **Date coverage regression:** Re-run checks when new periods arrive, including partial-year coverage, missing month keys and the latest available month.
7. **End-to-end validation:** Run the full authenticated benchmark against independently calculated expected values, including filters, ranking order, formula denominators, missing data, negative profit, source metadata and multilingual queries.

## Data-quality audit scope

A read-only audit of all 10,000 retrieved `fact_orders` rows reported:

- No missing/null/blank values in the checked required fields: `order_id`, `order_date`, `buyer_id`, `country`, `revenue_inr`, `total_cost_inr`, `profit_inr`.
- No duplicate order IDs.
- No negative revenue or negative cost rows.
- 1,051 rows with negative recorded profit.
- No rows where revenue minus cost differed from recorded profit by more than ₹0.01.
- No rows where actual ship date preceded order date or due date preceded order date.

Negative profit is a flag for business review, not automatic proof of bad data. These checks cover only the listed fields and rules; they do not guarantee every business rule or source value is correct.

## Local setup

1. Install Node.js LTS.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `npm install && npm run dev`.
4. Run `npm run build` before deployment.
5. Run the Edge Function regression test with Node.js:

   ```bash
   node --test supabase/functions/ask-garment-data/benchmark-source-regression.test.mjs
   ```

Never expose a Supabase `service_role` key in browser code.

## Free Render static site

Repository: `Vignesh-S-V/Analytics`; branch: `main`; build command: `npm install && npm run build`; publish directory: `dist`. Add only the URL and public anon key as frontend build environment variables.

More details: `docs/KPI_CATALOG.md`, `docs/ADDITIONAL_DATA_REQUIREMENTS.md`, `sql/dashboard_views.sql`.
