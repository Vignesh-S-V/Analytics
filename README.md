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


## Application architecture and tool selection

This section documents the implementation currently present in the repository. It distinguishes live application paths from test-workspace components and SQL templates; a file existing in the repository does not, by itself, prove that a feature is enabled in production.

### Technology stack

| Tool / library | Where it is used | Why it is used |
|---|---|---|
| React 18 | `src/main.jsx` and dashboard components | Component-based UI, reusable dashboard sections, state and derived calculations |
| Vite 6 | `vite.config.js`, `package.json` | Frontend development server and production bundling |
| JavaScript (ES modules) | `src/` | Browser-side data shaping, filters, KPI calculations and scenario logic |
| CSS3 | `src/styles.css` and module CSS files | Responsive layout, visual system, cards, tables, charts and interaction states |
| Supabase JS v2 | `src/main.jsx` | Authentication and browser-side access to Supabase data / Edge Functions |
| Supabase Database (PostgreSQL) | `sql/`, Edge Function data sources | Persistent order, marketing, buyer, style, supplier, production and market data |
| Supabase Edge Functions (Deno) | `supabase/functions/ask-garment-data/index.ts` | Authenticated Ask AI API, deterministic analytics routes and controlled data retrieval |
| Recharts | `src/main.jsx` and dashboard modules | Bar, line, area, pie, composed and scatter charts |
| Framer Motion | `src/main.jsx` | UI motion and transitions |
| Lucide React | Dashboard components | Consistent interface icons |
| Node.js test runner | `package.json`, `*.test.mjs` | Regression tests for analytics utilities, routing, forecasting and source completeness |
| Python standard library + Cloudflare Workers Pyodide FFI | `python_backend/main.py` | Separate Python Ask AI worker implementation using the Workers Fetch API; do not assume it is the active production route without deployment verification |

### Main application areas and their implementation files

| Website area | Main implementation | What it is used for |
|---|---|---|
| Overview, authentication, navigation, core sales views and Ask AI UI | `src/main.jsx` | Main application shell, Supabase client, auth/session handling, data loading, sales summaries, comparisons and Ask AI interaction |
| Product Economics | `src/ProductEconomics.jsx` | Product/category/fabric/style economics, direct-cost breakdown, GP/NP, unit economics, rejection/rework indicators and what-if inputs |
| Executive / Revenue / Customer / Operational dashboards | `src/AdvancedDashboards.jsx`, `src/ProductPortfolio.jsx` | Revenue trends, comparisons, buyer/country/category contribution, concentration, forecast signals, anomalies and portfolio analysis |
| Procurement Intelligence | `src/ProcurementIntelligence.jsx` | Supplier-linked order exposure, delay/quality indicators, supplier concentration and material-market signals |
| Production Intelligence | `src/ProductionIntelligence.jsx` | Order/shipment quantities, efficiency, target gap, rejection proxy, cost mix, delay and production risk flags |
| Pivot report and manual growth scenario | `src/TestPivotReport.jsx` | Dynamic row hierarchy, month columns, actual vs previous-year values, YoY growth and user-entered growth scenario |
| Forecast test workspace | `src/TestForecasting.jsx`, `src/forecasting.js` | Grouped monthly time series, model comparison/backtesting, forecast intervals and manual growth override |
| Database aggregate view templates | `sql/dashboard_views.sql` | Starter PostgreSQL views for management, buyer, country, production, marketing, supplier and market summaries |
| KPI definitions and interpretation rules | `docs/KPI_CATALOG.md` | Business definitions, denominator rules and data requirements |

## Formula reference — what each calculation is for

The formulas below describe the current code paths and the documented SQL view definitions. All calculations are subject to the source columns, selected filters, date coverage and row grain. They are not a substitute for validating the business definition with finance or operations.

### 1. Core sales and financial KPIs

| KPI / formula | Calculation | Why it is used |
|---|---|---|
| Total revenue | `SUM(revenue_inr)` | Total recorded sales value for the selected scope |
| Total cost | `SUM(total_cost_inr)` | Recorded cost / expense total; use the source's cost definition |
| Recorded net profit | `SUM(profit_inr)` | Total recorded profit from the source rows |
| Weighted net profit margin (NP%) | `SUM(profit_inr) / SUM(revenue_inr) * 100` | Overall profitability without incorrectly averaging row-level percentages |
| Average revenue per order (AOV) | `SUM(revenue_inr) / COUNT(DISTINCT order_id)` | Average revenue represented by each distinct order |
| Profit reconciliation | `SUM(revenue_inr) - SUM(total_cost_inr) - SUM(profit_inr)` | Checks whether the supplied profit agrees with revenue less recorded cost |
| Country / buyer / product contribution | `Group revenue / Total revenue * 100` | Shows how much each dimension contributes to the selected total |
| Group weighted margin | `Group SUM(profit_inr) / Group SUM(revenue_inr) * 100` | Compares profitability at buyer, country, category or product grain |
| Fiscal-year revenue growth | `(Current FY revenue - Previous FY revenue) / ABS(Previous FY revenue) * 100` | Measures year-over-year change; requires comparable periods |
| Fiscal-year quantity growth | `(Current FY shipped qty - Previous FY shipped qty) / ABS(Previous FY shipped qty) * 100` | Separates shipment-volume change from revenue change |
| GP% (Product Economics) | `(Revenue - Direct cost) / Revenue * 100` | Estimates gross margin using the direct-cost components available to that module |
| NP% (Product Economics) | `Recorded profit / Revenue * 100` | Displays recorded net profit margin |
| Revenue per unit | `Revenue / Selected unit quantity` | Indicates realised revenue per shipped unit (or ordered quantity when shipped quantity is zero) |
| GP per unit | `Gross profit / Selected unit quantity` | Unit-level gross profit |
| NP per unit | `Recorded net profit / Selected unit quantity` | Unit-level recorded net profit |

**Important cost distinction:** Product Economics derives direct cost from fabric + trims + CMT per-piece fields multiplied by the module's selected quantity. It treats `total_cost_inr - direct_cost` as other cost. The GP% shown there is therefore based on those available direct-cost fields; it must not be presented as an audited accounting gross margin unless the cost mapping is complete and approved. The main sales NP% uses recorded `profit_inr`.

### 2. Production and delivery KPIs

| KPI / formula | Calculation in the current UI / source logic | Why it is used / limitation |
|---|---|---|
| Ordered quantity | `SUM(order_qty)` | Total order quantity in the selected rows |
| Shipped quantity | `SUM(shipped_qty)` | Quantity recorded as shipped |
| Fill / shipment completion rate | `Shipped quantity / Ordered quantity * 100` | Measures quantity fulfilment; it is not the same as on-time delivery |
| Rejection proxy | `SUM(rejection_qty) / SUM(order_qty) * 100` | Rejected quantity relative to ordered quantity; label remains a proxy unless the production denominator is confirmed |
| On-time shipment rate | `On-time dated shipments / Shipments with both due and actual dates * 100` | Uses only rows with both `ship_due_date` and `actual_ship_date`; undated rows are excluded |
| On-time rule | `actual_ship_date <= ship_due_date` | A shipment on the due date counts as on time |
| Efficiency gap | `Average actual efficiency - Average target efficiency` | Difference is expressed in percentage points (pp), not percent growth |
| Efficiency target attainment | `MIN(Average actual efficiency / Average target efficiency * 100, 100)` | Visualises attainment and caps the displayed attainment at 100% |
| Average delay days (order-linked) | `SUM(delay_days) / Count of rows with delay_days` | Average of populated delay values; the source's definition of delay_days must be respected |
| Rework cost per shipped piece | `SUM(rework_cost_inr) / SUM(shipped_qty)` | Unit rework-cost indicator when shipped quantity is available |
| Cost component extension | `Per-piece cost field * (shipped_qty if non-zero, otherwise order_qty)` | Converts fabric, trims, CMT, overtime and overhead unit costs into extended values |

Production risk flags in `ProductionIntelligence.jsx` are rule-based indicators, not a predictive model: late shipment adds 2 points; below-target efficiency adds 1; rejection above 3% adds 2; and a positive late penalty adds 1. Rows with a score above zero are shown for review. The 3% rejection threshold is a code-level rule, not a universal industry standard.

### 3. Marketing funnel and channel efficiency

The SQL view template `vw_marketing_channel_performance` defines the following measures from `fact_marketing`:

| KPI | Formula | Purpose |
|---|---|---|
| Inquiry-to-sample rate | `Samples sent / Inquiries * 100` | Measures inquiry conversion into samples |
| Sample-to-won-order rate | `Orders won / Samples sent * 100` | Measures sample conversion into won orders |
| Inquiry-to-won-order rate | `Orders won / Inquiries * 100` | Measures end-to-end funnel conversion |
| Cost per inquiry | `Marketing spend / Inquiries` | Average acquisition spend per inquiry |
| Cost per won order | `Marketing spend / Orders won` | Average spend per won order |
| ROAS | `Attributed order value / Marketing spend` | Revenue-value return per unit of marketing spend; it is **not** profit ROI |

A zero denominator should produce an unavailable / null result rather than an invented percentage. Funnel rates are only meaningful when the underlying counts use compatible time windows and cohorts.

### 4. Procurement and supplier measures

| KPI | Formula / implementation | Purpose and caution |
|---|---|---|
| Supplier-linked revenue | `SUM(revenue_inr)` for rows with a supplier ID, grouped by supplier | Revenue associated with orders linked to each supplier; not supplier sales |
| Supplier-linked order cost | `SUM(total_cost_inr)` for supplier-linked orders | Order cost exposure; it is **not** purchase-order spend or accounts-payable balance |
| Supplier revenue share | `Supplier linked revenue / Total supplier-linked revenue * 100` | Measures dependency on a supplier |
| Top-five supplier share | `SUM(top 5 supplier revenue shares)` | Concentration of supplier-linked revenue |
| HHI concentration | `SUM((Supplier revenue share in percentage points)^2)` | Higher values indicate more concentration; interpret with the number of suppliers and scope |
| Linked-order rejection ratio | `Rejected qty / Ordered qty * 100` | Supplier-linked order quality signal; not necessarily a supplier-caused defect rate |
| Linked-order on-time rate | `On-time linked orders / Dated linked orders * 100` | Uses due/actual date pairs and measures customer shipment outcome for linked orders |
| Average supplier master delay | Average populated `dim_suppliers.avg_delay_days` values | Master-data indicator; not the same as delay calculated from order rows |
| Average linked-order delay | `SUM(delay_days) / Count of populated delay rows` per supplier | Order-level delay signal; depends on the meaning and coverage of `delay_days` |
| Yarn month-over-month change | `(Latest yarn index - Prior yarn index) / Prior yarn index * 100` | Market-price movement; not the company's actual purchase-price inflation |

Supplier delay and quality ratings must be interpreted using the supplier master-data definitions and contractual SLAs. Correlation between supplier and shipment outcomes does not establish supplier causation.

### 5. Revenue intelligence, concentration and scenario calculations

| Measure | Calculation / method | What it tells us |
|---|---|---|
| Revenue growth | `(Current period revenue - Previous period revenue) / ABS(Previous period revenue) * 100` | Period-over-period growth, when the compared windows are complete and comparable |
| Price-volume bridge | Uses average of old/new unit realisation and old/new shipped quantity: `Volume effect = (Q1-Q0) * (P0+P1)/2`; `Price effect = (P1-P0) * (Q0+Q1)/2` | Decomposes revenue movement into volume and realised-price effects; the two effects sum to the revenue change when revenue = quantity × unit realisation |
| Unit realisation | `Revenue / Shipped quantity` | Average realised revenue per shipped unit |
| Buyer / country / category concentration | Top-1 share, top-5 share and HHI from revenue shares | Highlights dependency and concentration risk |
| Revenue anomaly signal | Rolling six-month median and median absolute deviation (MAD); robust score approximately `0.6745 * (Current revenue - Median) / MAD` | Flags unusually high/low months; it is a statistical review signal, not proof of fraud or cause |
| Manual price scenario | `Revenue * (1 + Price change %)` | Illustrates a price-only assumption |
| Manual volume scenario | `Revenue * (1 + Volume change %)` | Illustrates a volume-only assumption |
| Combined scenario | `Revenue * (1 + Price %) * (1 + Volume %)` | Applies price and volume assumptions multiplicatively |
| Buyer-loss scenario | Subtracts the selected buyer's revenue and cost exposure multiplied by the assumed loss percentage | Illustrates exposure if some share of a buyer is lost; not a demand forecast |
| Pivot growth scenario | `Selected actual revenue * (1 + User growth % / 100)` | Applies a user-entered growth assumption to the selected month / scope; not model-generated |

### 6. Forecasting methods and model selection

The forecast test workspace in `src/forecasting.js` aggregates order rows into monthly series by the selected dimensions and measure. The candidate models are evaluated using rolling-origin backtesting where sufficient history exists.

| Model / method | How it works | When it is useful |
|---|---|---|
| Naive | Repeats the latest observed value | Simple baseline |
| Seasonal Naive | Repeats the corresponding month from the previous 12-month cycle | Stable annual seasonality with enough history |
| Damped Trend | Fits a recent linear trend and gradually reduces its future effect (damping factor 0.85 in the implementation) | Trend exists but should not extrapolate indefinitely |
| Trend + Seasonality | Fits a trend on recent history and applies month-of-year seasonal factors | Series with trend and recurring monthly patterns |
| Croston SBA | Separately smooths non-zero demand size and the interval between non-zero observations; applies the SBA bias adjustment | Intermittent / sparse demand |
| Top-down child allocation | Forecasts the parent series, then allocates the forecast to child groups using each child's trailing 12-month share | Hierarchical forecasts where parent totals should guide child estimates |

**Forecast evaluation metrics**

- MAE (Mean Absolute Error) = `Mean(|Actual - Forecast|)`; average absolute error in the measure's units.
- WAPE (Weighted Absolute Percentage Error) = `SUM(|Actual - Forecast|) / SUM(|Actual|) * 100`; scales total absolute error by total actual volume.
- sMAPE = mean of `2 * |Actual - Forecast| / (|Actual| + |Forecast|) * 100`; symmetric percentage error, with zero-denominator cases excluded / handled by the implementation.
- Forecast lower / upper bands are derived from historical backtest errors by forecast lead. They are empirical error bands, not guaranteed statistical confidence intervals.

The series classifier uses demand frequency and variability (including average demand interval and squared coefficient of variation) to identify intermittent demand and decide which candidate models to test. The model is selected by backtested WAPE with deterministic tie ordering. If history is insufficient for a reliable backtest, the UI may show a simple fallback baseline and mark it as unvalidated. Do not describe that fallback as a validated forecast.

The separate `AdvancedDashboards.jsx` revenue view contains a simpler linear-trend / moving-average / seasonal-naive comparison and six-month rolling backtest for its own overview panels. It is a distinct implementation from the more detailed `src/forecasting.js` test workspace; the two should not be assumed to produce identical forecasts.

### 7. Ask AI — how a question is answered

The Ask AI request path is implemented primarily in `supabase/functions/ask-garment-data/index.ts` with shared intent helpers in `analytics-utils.mjs`.

1. The user submits a natural-language question from the React application.
2. The Edge Function validates the request, authentication/session and workspace access, then applies request limits and allowed-origin checks.
3. Intent detection identifies supported deterministic questions such as core KPIs, product/buyer/country rankings, period comparisons and business-area investigations.
4. For supported routes, the function reads approved analytics relations, applies filters and aggregation, and returns the answer with source metadata where implemented.
5. For questions not handled by a deterministic route, the function can use its retrieval / LLM path. The presence of an LLM path does not mean every answer is independently verified; check the returned source and limitations.
6. The frontend formats tabular answers and derives display insights from the returned answer text.

**Why deterministic formulas are preferred for core KPIs:** revenue, cost, profit, margin, order counts and rankings have explicit denominators and source relations. A deterministic route is easier to test and reconcile than asking a language model to invent arithmetic. LLM/retrieval is reserved for questions that need broader interpretation, with source evidence and uncertainty disclosed.

The SQL-agent implementation is constrained to approved analytics relations and read-only execution. Its SQL guardrails are not a replacement for database permissions or row-level security. The Python implementation in `python_backend/` is a separate worker code path and should be treated as deployed only after its Cloudflare Worker configuration and production route are verified.

## Formula interpretation and data-quality guardrails

- Never average row-level margin percentages to calculate an overall margin. Use total profit divided by total revenue.
- Never add aggregate-view row counts together and call the result unique orders. Views have different grains and may overlap.
- Use `COUNT(DISTINCT order_id)` for distinct order counts when working from order-line or fact rows.
- AOV must be computed at the correct order grain. If a source contains multiple lines per order, do not divide by row count.
- Revenue growth with a zero previous-period denominator is unavailable; do not report an infinite percentage.
- Percentage-point difference (for example, 62% actual efficiency − 70% target = −8 pp) is not the same as percentage growth.
- On-time delivery requires both due and actual dates. Excluding undated rows changes the denominator; always disclose coverage.
- Rejection rate should ideally use produced pieces as the denominator. The current production UI uses ordered quantity as a proxy where no validated production-quantity denominator is wired.
- ROAS is attributed order value divided by marketing spend. It does not subtract cost of goods, fulfilment or other expenses and is not ROI.
- Supplier-linked order cost is not PO spend. Supplier-linked shipment outcomes do not prove supplier fault.
- A market yarn index is an external benchmark, not the company's realised purchase cost.
- A scenario slider is a user-defined assumption, not a forecast or committed target.
- A chart or KPI showing no data should remain unavailable rather than silently substituting zero when the distinction matters.
- Always validate source freshness, missing months, filter scope, row grain and formula denominator before making business decisions.

## Test commands

Run the complete configured test suite:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

The current test script covers the Edge Function analytics utilities, source-regression checks, buyer ranking, SQL-agent regression and forecasting tests. A passing unit/regression suite does not replace an authenticated end-to-end test against the production workspace.


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
