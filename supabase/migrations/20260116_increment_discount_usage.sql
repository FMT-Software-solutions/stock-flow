create or replace function increment_discount_usage(p_discount_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_limit int;
  v_used int;
begin
  -- Lock the row for update to prevent race conditions
  select usage_limit, times_used into v_limit, v_used
  from discounts
  where id = p_discount_id
  for update;
  
  -- If limit exists and we are at or over it, fail.
  if v_limit is not null and v_used >= v_limit then
    return false;
  end if;

  update discounts
  set times_used = coalesce(times_used, 0) + 1,
      updated_at = now()
  where id = p_discount_id;
  
  return true;
end;
$$;
