-- ThreadIQ read-only SQL agent RPC.
-- Requires a signed-in user with active ThreadIQ workspace membership.
-- Defense-in-depth allowlist: only approved analytics views and fact_orders are queryable.
create or replace function public.threadiq_run_readonly_query(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  cleaned text := btrim(p_sql);
  result jsonb;
  rel_match text[];
  rel_name text;
  cte_match text[];
  cte_names text[] := array[]::text[];
  allowed_relations text[] := array[
    'vw_sales_monthly_by_country',
    'vw_sales_by_country',
    'vw_sales_by_buyer',
    'vw_sales_by_product',
    'vw_marketing_channel_performance',
    'vw_production_by_line',
    'vw_supplier_scorecard',
    'vw_market_monthly',
    'fact_orders'
  ];
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required';
  end if;

  if not exists (
    select 1
    from public.threadiq_workspace_members m
    where m.user_id = auth.uid()
      and m.is_active = true
  ) then
    raise exception 'Active workspace membership is required';
  end if;

  if cleaned !~* '^(select|with)\s' then
    raise exception 'Only SELECT queries are allowed';
  end if;

  if cleaned ~ ';' or cleaned ~ '--' or cleaned ~ '/\*' then
    raise exception 'Multiple statements or comments are not allowed';
  end if;

  if cleaned ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|set|reset|vacuum|lock|auth|storage|information_schema|pg_[a-z_]+|threadiq_[a-z_]+)\M' then
    raise exception 'Query contains a forbidden keyword or object';
  end if;

  -- Recognize simple CTE names so they may be used as FROM/JOIN sources.
  for cte_match in
    select regexp_matches(cleaned, '(?:with|,)\s*([a-z_][a-z0-9_]*)\s+as\s*\(', 'gi')
  loop
    cte_names := array_append(cte_names, lower(cte_match[1]));
  end loop;

  -- Reject relations outside the approved analytics surface.
  for rel_match in
    select regexp_matches(cleaned, '\m(?:from|join)\s+(?:public\.)?([a-z_][a-z0-9_]*)', 'gi')
  loop
    rel_name := lower(rel_match[1]);
    if rel_name = any(allowed_relations) or rel_name = any(cte_names) then
      continue;
    end if;
    raise exception 'Relation "%" is not allowed for the analytics agent', rel_name;
  end loop;

  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true);

  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (' || cleaned || ') q limit 500) t'
    into result;
  return result;
end
$$;

revoke all on function public.threadiq_run_readonly_query(text) from public, anon;
grant execute on function public.threadiq_run_readonly_query(text) to authenticated;
