# KPI Catalogue and Guardrails

All KPIs must be computed from validated source rows. The sample dashboard numbers are illustrative only.

## Management and finance
- Revenue: sum of order revenue; specify whether amounts are booked, invoiced, or shipped.
- Profit: revenue minus included cost components. Freight, penalties, rework, commissions, tax and finance cost must be defined before calling this operating or net profit.
- Margin: total profit divided by total revenue; use weighted totals rather than average row percentages.
- Cash flow, NPV and IRR require dated cash flows; profit alone is not cash flow.

## Sales and buyers
- Buyer contribution margin: sum of attributed profit / sum of revenue.
- Average order value: revenue / distinct orders, only if the table's grain is understood.
- Repeat buyer rate needs sufficient historical order coverage.
- Delivery metrics require order due date and actual shipment date.

## Production
- Efficiency gap: actual efficiency minus target efficiency, expressed in percentage points.
- Rejection rate: rejected pieces / produced pieces. Order quantities are not a substitute for production quantities.
- Rework cost per piece needs reliable rework cost and quantity.
- Line-level utilization, downtime and absenteeism need daily line/time/attendance data.

## Marketing
- Inquiry-to-sample: samples sent / inquiries.
- Sample-to-won order: won orders / samples sent; cohort alignment matters.
- Cost per won order: marketing spend / won orders.
- ROAS: attributed order value / marketing spend. ROAS is not profit ROI.

## Procurement and inventory
- Supplier delay and quality score require defined source semantics.
- Yarn/material market index is not the company's actual purchased cost.
- Inventory ageing and dead stock require stock snapshots, movement history, unit cost and last-movement date.

## Current status
Supabase project URL: https://rzsgdfpwnxhseyxtrrlx.supabase.co
Expected tables: `fact_orders`, `fact_marketing`, `dim_buyers`, `dim_styles`, `dim_lines`, `dim_suppliers`, `dim_market`.
Dataset import and row-level security SELECT policies are prerequisites for live figures. Never expose the Supabase service-role key in a frontend app.
