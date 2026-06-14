-- Atomic watering-can spend. The Edge Function previously read both buckets, checked
-- them, and wrote the decrement back later — N parallel requests could all read the
-- same balance and spend one token N times. This function does check + spend in one
-- transaction under row locks, so the rate limit actually holds under concurrency.
--
-- The refill math (one token per refill_ms, capped) MUST match refillBucket() in
-- src/engine/bucket.ts — the engine stays the source of truth for the rule; this is
-- its one transactional mirror, kept here only because the spend must be atomic in
-- the database.
create or replace function public.spend_tend_tokens(
  device_key text,
  ip_key text,
  now_ms bigint,
  device_cap real,
  device_refill_ms real,
  ip_cap real,
  ip_refill_ms real
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d_tokens real;
  i_tokens real;
begin
  -- Ensure both rows exist, then lock them in a fixed order (device, then ip)
  -- so concurrent spenders can't deadlock.
  insert into public.buckets (device, tokens, at) values (device_key, device_cap, now_ms)
    on conflict (device) do nothing;
  insert into public.buckets (device, tokens, at) values (ip_key, ip_cap, now_ms)
    on conflict (device) do nothing;

  select least(device_cap, tokens + greatest(0, now_ms - at) / device_refill_ms)
    into d_tokens
    from public.buckets where device = device_key
    for update;
  select least(ip_cap, tokens + greatest(0, now_ms - at) / ip_refill_ms)
    into i_tokens
    from public.buckets where device = ip_key
    for update;

  -- A concurrent prune may delete a stale row between the insert above and the locked
  -- select. A prunable bucket is by definition fully refilled, so missing = full can.
  if d_tokens is null then
    insert into public.buckets (device, tokens, at) values (device_key, device_cap, now_ms)
      on conflict (device) do update set tokens = excluded.tokens, at = excluded.at;
    d_tokens := device_cap;
  end if;
  if i_tokens is null then
    insert into public.buckets (device, tokens, at) values (ip_key, ip_cap, now_ms)
      on conflict (device) do update set tokens = excluded.tokens, at = excluded.at;
    i_tokens := ip_cap;
  end if;

  if d_tokens < 1 or i_tokens < 1 then
    -- Rejection updates no balances. (The ensure-exists inserts above may have
    -- created rows — bounded, since prune drops fully-refilled buckets.)
    return jsonb_build_object('accepted', false, 'tokens', d_tokens, 'at', now_ms);
  end if;

  update public.buckets set tokens = d_tokens - 1, at = now_ms where device = device_key;
  update public.buckets set tokens = i_tokens - 1, at = now_ms where device = ip_key;
  return jsonb_build_object('accepted', true, 'tokens', d_tokens - 1, 'at', now_ms);
end;
$$;

-- Only the Edge Function (service role) may spend; RLS already locks the table itself.
revoke execute on function public.spend_tend_tokens from public, anon, authenticated;
