-- Enable pg_cron and pg_net extensions to trigger the resumable nightly scrape batches on Vercel
-- Reads the cron bearer secret from Supabase Vault ('cron_secret') so no secret ever enters git.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.trigger_vercel_nightly_scrape(p_batch_size integer default 45)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_req_id bigint;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'cron_secret'
  limit 1;

  if v_secret is null then
    raise exception 'Missing cron_secret in vault.decrypted_secrets';
  end if;

  select net.http_post(
    url := 'https://<your-vercel-domain>.vercel.app/api/cron/scrape?batchSize=' || p_batch_size::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := '{}'::jsonb
  ) into v_req_id;

  return v_req_id;
end;
$$;

revoke all on function public.trigger_vercel_nightly_scrape(integer) from public, anon, authenticated;
grant execute on function public.trigger_vercel_nightly_scrape(integer) to postgres, service_role;

-- Schedule 3 polite nightly batches at 02:05, 02:25, and 02:45 UTC (~45 rooms per batch = ~135 rooms/night)
select cron.schedule(
  'eth-nightly-scrape-batch-1',
  '5 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(45);$$
);

select cron.schedule(
  'eth-nightly-scrape-batch-2',
  '25 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(45);$$
);

select cron.schedule(
  'eth-nightly-scrape-batch-3',
  '45 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(45);$$
);
