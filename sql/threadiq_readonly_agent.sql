-- ThreadIQ read-only SQL agent RPC.
-- Deploy this in Supabase SQL Editor after reviewing the policy notes below.
create or replace function public.threadiq_run_readonly_query(p_sql text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  cleaned text := btrim(regexp_replace(p_sql, ';\s*$', ''));
  result jsonb;
begin
  if cleaned !~* '^(select|with)\s' then
    raise exception 'Only SELECT queries are allowed';
  end if;
  if cleaned ~ ';' or cleaned ~ '--' or cleaned ~ '/\*' then
    raise exception 'Multiple statements or comments are not allowed';
  end if;
  if cleaned ~* '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|set|reset|vacuum|lock|auth|storage|information_schema|pg_[a-z_]+|threadiq_[a-z_]+)\M' then
    raise exception 'Query contains a forbidden keyword or object';
  end if;

  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true);

  execute 'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from ('
          || cleaned || ') q limit 500) t'
  into result;
  return result;
end $$;

revoke all on function public.threadiq_run_readonly_query(text) from public, anon;
grant execute on function public.threadiq_run_readonly_query(text) to authenticated;
