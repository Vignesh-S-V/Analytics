# ThreadIQ — Tirupur Garment Business Intelligence

A free-tier-first React/Vite dashboard starter for garment export operations in Tirupur.

## Included
- Management overview with illustrative revenue, profit, margin and late-order KPIs
- Sales / buyer profitability table
- Production, marketing and procurement decision prompts
- Investment Lab with editable capex, monthly savings and payback assumptions
- Responsive dark, 3D-inspired dashboard UI
- Optional Supabase browser connection using the public anon/publishable key only

## Important data integrity note
The dashboard initially uses **illustrative demo values**. Do not use them for business decisions. The workbook rows have not yet been imported into Supabase. Once imported and appropriate least-privilege read policies are applied, the UI can read the required tables; see the current app code for the precise tables and limits.

## Local setup
1. Use Node.js LTS.
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon key only).
4. Run `npm install`, then `npm run dev`.
5. Run `npm run build` before deployment.

## Supabase
Project URL: https://rzsgdfpwnxhseyxtrrlx.supabase.co

Tables expected:
- `fact_orders`
- `fact_marketing`
- `dim_buyers`
- `dim_styles`
- `dim_lines`
- `dim_suppliers`
- `dim_market`

**Never expose a `service_role` key in browser code or Vite variables.** Add least-privilege SELECT policies only after reviewing row-level security requirements.

## Free Render static-site deployment
- Repository: `Vignesh-S-V/Analytics`
- Branch: `main`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

The repo includes no secret keys or business-data workbook. Free-tier availability and limits may change.

## Documentation
- [KPI catalogue](docs/KPI_CATALOG.md)
- [Additional data requirements](docs/ADDITIONAL_DATA_REQUIREMENTS.md)
- [SQL dashboard views](sql/dashboard_views.sql)
