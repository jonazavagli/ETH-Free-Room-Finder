-- Tune pg_cron nightly batch schedule so all ~243 ETH teaching rooms (plus UZH 3vrooms)
-- refresh every single night (4 staggered batches x 65 rooms = 260 capacity at 02:05..02:50 UTC),
-- while Vercel Cron runs separately in the 03:xx UTC hour as a non-overlapping retry sweep.

select cron.schedule(
  'eth-nightly-scrape-batch-1',
  '5 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(65);$$
);

select cron.schedule(
  'eth-nightly-scrape-batch-2',
  '20 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(65);$$
);

select cron.schedule(
  'eth-nightly-scrape-batch-3',
  '35 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(65);$$
);

select cron.schedule(
  'eth-nightly-scrape-batch-4',
  '50 2 * * *',
  $$select public.trigger_vercel_nightly_scrape(65);$$
);
