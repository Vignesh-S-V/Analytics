-- Starter aggregate views for the Supabase schema.
-- Apply only AFTER importing the workbook and reviewing RLS requirements.
-- These views are illustrative templates: validate exact column names and business meanings.

create or replace view public.vw_management_monthly
with (security_invoker = true) as
select
  date_trunc('month', order_date)::date as month_start,
  sum(coalesce(revenue_inr,0)) as revenue_inr,
  sum(coalesce(total_cost_inr,0)) as total_cost_inr,
  sum(coalesce(profit_inr,0)) as profit_inr,
  case when sum(coalesce(revenue_inr,0)) = 0 then null
       else sum(coalesce(profit_inr,0)) / sum(revenue_inr) * 100 end as profit_margin_pct,
  count(distinct order_id) as order_count,
  count(*) filter (where coalesce(delay_days,0) > 0) as delayed_rows
from public.fact_orders
group by 1;

create or replace view public.vw_sales_by_buyer
with (security_invoker = true) as
select buyer_id, buyer_name, sum(coalesce(revenue_inr,0)) revenue_inr,
       sum(coalesce(profit_inr,0)) profit_inr,
       case when sum(coalesce(revenue_inr,0))=0 then null
            else sum(coalesce(profit_inr,0))/sum(revenue_inr)*100 end profit_margin_pct,
       count(distinct order_id) order_count
from public.fact_orders
group by buyer_id, buyer_name;

create or replace view public.vw_sales_by_country
with (security_invoker = true) as
select country, sum(coalesce(revenue_inr,0)) revenue_inr,
       sum(coalesce(profit_inr,0)) profit_inr, count(distinct order_id) order_count
from public.fact_orders
group by country;

create or replace view public.vw_production_by_line
with (security_invoker = true) as
select l.line_id, l.line_name,
       avg(l.efficiency_pct) efficiency_pct,
       avg(l.target_efficiency_pct) target_efficiency_pct,
       avg(l.quality_score) quality_score
from public.dim_lines l
group by l.line_id, l.line_name;

create or replace view public.vw_marketing_channel_performance
with (security_invoker = true) as
select channel, sum(coalesce(marketing_spend_inr,0)) marketing_spend_inr,
       sum(coalesce(inquiries,0)) inquiries, sum(coalesce(samples_sent,0)) samples_sent,
       sum(coalesce(orders_won,0)) orders_won,
       sum(coalesce(order_value_won_inr,0)) order_value_won_inr,
       case when sum(coalesce(marketing_spend_inr,0))=0 then null
            else sum(coalesce(order_value_won_inr,0))/sum(marketing_spend_inr) end roas
from public.fact_marketing
group by channel;

create or replace view public.vw_supplier_scorecard
with (security_invoker = true) as
select supplier_id, supplier_name, avg(delay_days) avg_delay_days,
       avg(quality_rating) avg_quality_rating
from public.dim_suppliers
group by supplier_id, supplier_name;

create or replace view public.vw_market_monthly
with (security_invoker = true) as
select month, country, category, avg(yarn_price_index) yarn_price_index,
       avg(freight_index) freight_index, avg(demand_index) demand_index
from public.dim_market
group by month, country, category;
