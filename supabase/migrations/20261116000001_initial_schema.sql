-- Initial Database Schema for Free Room Finder
-- Enforces half-open booking intervals, transactional booking replacement, and Row-Level Security (RLS).

-- 1. Buildings
create table if not exists public.buildings (
  id text primary key,                    -- e.g. 'ETH:HG', 'UZH:KOL'
  institution text not null check (institution in ('ETH', 'UZH')),
  campus text not null,                   -- e.g. 'Zentrum', 'Hönggerberg', 'Irchel', 'Oerlikon'
  code text not null,                     -- e.g. 'HG', 'HIL', 'KOL', 'Y15'
  name text not null,                     -- e.g. 'Hauptgebäude'
  address text,
  lat double precision,
  lng double precision,
  official_map_url text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_buildings_institution_campus on public.buildings(institution, campus);

-- 2. Rooms (teaching rooms + open study spaces)
create table if not exists public.rooms (
  id text primary key,                    -- e.g. 'ETH:HG E 3', 'UZH:HAH-E-03'
  building_id text not null references public.buildings(id) on delete cascade,
  institution text not null check (institution in ('ETH', 'UZH')),
  campus text not null,
  building_code text not null,
  floor text not null,
  room_number text not null,
  display_name text not null,             -- Source's exact room name, e.g. 'HG E 3'
  room_type text not null,                -- 'lecture_hall', 'seminar_room', 'study_space', 'computer_room', 'other'
  source_room_type text not null,         -- Raw label from source, e.g. 'Hörsaal'
  capacity integer,
  exam_capacity integer,
  official_details jsonb not null default '{}'::jsonb, -- outlets, board, desk_type, wheelchair, quiet_area, opening_hours
  official_url text,
  live_occupancy_key text,                -- e.g. 'CABF31' for ETH study spaces in availability.json
  schedule_status text not null check (schedule_status in ('ok', 'always_open', 'unknown')),
  last_scraped_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_rooms_building on public.rooms(building_id);
create index if not exists idx_rooms_institution_campus on public.rooms(institution, campus);
create index if not exists idx_rooms_schedule_status on public.rooms(schedule_status);

-- 3. Bookings (half-open intervals [start_time, end_time))
create table if not exists public.bookings (
  id bigserial primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  title text not null,                    -- Course/event title or 'Occupied' (never personal names)
  booking_type text,                      -- e.g. 'Lehrveranstaltung', 'Sonstige Veranstaltung', 'blocked'
  source text not null,                   -- 'eth_rauminfo' | 'uzh_3vrooms'
  scraped_at timestamptz not null default now(),
  constraint bookings_valid_interval check (end_time > start_time)
);

create index if not exists idx_bookings_room_time on public.bookings(room_id, start_time, end_time);
create index if not exists idx_bookings_start_end on public.bookings(start_time, end_time);

-- 4. Scrape Runs & Resumable Queue
create table if not exists public.scrape_runs (
  id bigserial primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rooms_succeeded integer not null default 0,
  rooms_failed integer not null default 0,
  bookings_written integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  verdict text not null default 'running' check (verdict in ('running', 'ok', 'partial', 'quarantined', 'failed'))
);

create index if not exists idx_scrape_runs_source_started on public.scrape_runs(source, started_at desc);

create table if not exists public.scrape_queue (
  room_id text primary key references public.rooms(id) on delete cascade,
  source text not null,
  cohort integer not null default 0 check (cohort in (0, 1)),
  next_scrape_after timestamptz not null default now(),
  last_attempt_at timestamptz,
  last_status text,
  last_error text
);

create index if not exists idx_scrape_queue_next on public.scrape_queue(source, next_scrape_after);

-- 5. Community Contributions (Lock Reports, Detail Votes, Photos)
create table if not exists public.lock_reports (
  id bigserial primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  reported_at timestamptz not null default now(),
  is_locked boolean not null,
  device_hash text not null,
  hidden boolean not null default false
);

create index if not exists idx_lock_reports_room_visible on public.lock_reports(room_id, reported_at) where (hidden = false);

create table if not exists public.detail_reports (
  id bigserial primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  detail_name text not null check (detail_name in ('outlets', 'board', 'desk_type', 'lighting', 'noise')),
  detail_value text not null,
  reported_at timestamptz not null default now(),
  device_hash text not null,
  hidden boolean not null default false
);

create index if not exists idx_detail_reports_room_visible on public.detail_reports(room_id, detail_name, reported_at desc) where (hidden = false);

create table if not exists public.photos (
  id bigserial primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  device_hash text not null,
  hidden boolean not null default false
);

create index if not exists idx_photos_room_visible on public.photos(room_id, uploaded_at desc) where (hidden = false);

-- 6. Transactional function to replace a room's bookings for a time window atomically
create or replace function public.replace_room_bookings_for_window(
  p_room_id text,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_source text,
  p_scraped_at timestamptz,
  p_schedule_status text,
  p_bookings jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  -- Delete existing bookings for this room overlapping the scraped window
  delete from public.bookings
  where room_id = p_room_id
    and start_time >= p_window_start
    and start_time < p_window_end;

  -- Insert validated new bookings if any
  if jsonb_typeof(p_bookings) = 'array' and jsonb_array_length(p_bookings) > 0 then
    insert into public.bookings (room_id, start_time, end_time, title, booking_type, source, scraped_at)
    select
      p_room_id,
      (item->>'start_time')::timestamptz,
      (item->>'end_time')::timestamptz,
      coalesce(nullif(trim(item->>'title'), ''), 'Booked'),
      item->>'booking_type',
      p_source,
      p_scraped_at
    from jsonb_array_elements(p_bookings) as item
    where (item->>'end_time')::timestamptz > (item->>'start_time')::timestamptz;

    get diagnostics v_inserted = row_count;
  end if;

  -- Update room's schedule_status and last_scraped_at in the same transaction
  update public.rooms
  set
    schedule_status = p_schedule_status,
    last_scraped_at = p_scraped_at,
    updated_at = now()
  where id = p_room_id;

  return v_inserted;
end;
$$;

-- Revoke public execute on mutating RPC; only service_role may execute
revoke all on function public.replace_room_bookings_for_window(text, timestamptz, timestamptz, text, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.replace_room_bookings_for_window(text, timestamptz, timestamptz, text, timestamptz, text, jsonb) to service_role;

-- 7. Row-Level Security (RLS) on every table
alter table public.buildings enable row level security;
alter table public.rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.scrape_queue enable row level security;
alter table public.lock_reports enable row level security;
alter table public.detail_reports enable row level security;
alter table public.photos enable row level security;

-- Public read-only policies for buildings, rooms, bookings, and scrape_runs
create policy "Public can read buildings"
  on public.buildings for select
  to anon, authenticated
  using (true);

create policy "Public can read rooms"
  on public.rooms for select
  to anon, authenticated
  using (true);

create policy "Public can read bookings"
  on public.bookings for select
  to anon, authenticated
  using (true);

create policy "Public can read scrape_runs"
  on public.scrape_runs for select
  to anon, authenticated
  using (true);

-- Contributions: only non-hidden rows readable; all writes go through server service_role
create policy "Public can read visible photos"
  on public.photos for select
  to anon, authenticated
  using (hidden = false);
