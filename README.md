# ThreadIQ — Tirupur Garment Business Intelligence

A free-tier-first React/Vite dashboard starter for garment export operations in Tirupur.

## Data integrity
The dashboard uses clearly-labelled illustrative demo values until the workbook data is imported into Supabase. Do not use demo values for business decisions. The current Supabase tables are empty. Never expose a Supabase service_role key in browser code.

## Local setup
1. Install Node.js LTS.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `npm install && npm run dev`.
4. Check `npm run build` before deployment.

## Free Render static site
Repository `Vignesh-S-V/Analytics`, branch `main`, build command `npm install && npm run build`, publish directory `dist`. Add the URL and public anon key as build environment variables only.

More details: `docs/KPI_CATALOG.md`, `docs/ADDITIONAL_DATA_REQUIREMENTS.md`, `sql/dashboard_views.sql`.
