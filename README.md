# Free Room Finder (ETH Zürich & UZH)

> **Unofficial student project** — not affiliated with, endorsed by, or operated by ETH Zürich or the University of Zurich (UZH).

A calm, mobile-first web app that answers one question in one step: **which teaching rooms and open study spaces at ETH Zürich and UZH are free to study in today (`Europe/Zurich`)?**

---

## Core Definitions

1. **Free ≠ unlocked or empty:** "Free" strictly means no booking in the official university schedule overlaps your requested time window. Always check the room respectfully and yield immediately if an unscheduled class or staff event is taking place.
2. **Live occupancy (estimates):** Available only for ETH's official student workspaces (`0%–100%` in 20% steps, refreshed every 5 minutes by ETH from aggregated anonymous network data).
3. **Today only:** All searches evaluate the current calendar day in `Europe/Zurich` time (including CET/CEST daylight-saving transitions).
4. **Unknown is never free:** Any bookable room whose schedule has not been fetched yet is separated into its own **"Schedule not found"** group—never shown as free and never silently hidden.

---

## Features

- **Fast today-only search:** "Free from now" (default 2 hours) or a custom window today, filterable by university (`Both`, `ETH`, `UZH`), campus (`Zentrum`, `Hönggerberg`, `Irchel`, `Oerlikon`, `Basel`), multi-select searchable buildings, room types, minimum seat count, and room features (`Power outlets`, `Board`, `Quiet space`).
- **Shareable without accounts:** Filter state lives in the URL query string and restores your last-used settings locally.
- **Three views over one result set:**
  - **List:** Free-until times, seat counts, live ETH study-space occupancy badges, and community door-lock hints.
  - **Timeline:** 07:00–22:00 visual schedule with diagonally striped booked blocks (never relying on colour alone) and a live "Now" indicator.
  - **Map:** Interactive MapLibre GL + OpenStreetMap building pins showing matching room counts per building.
- **Official-first room pages & privacy-safe contributions:**
  - Displays official ETH Rauminfo room photos (linked directly from ETH, never copied) and official equipment attributes where available online.
  - Where official photos or details are missing (e.g., UZH rooms and open study areas), friends can vote on room details (1 vote per device, majority wins, ties go to most recent), report whether a door was open or locked, and upload room photos (shrunk on `<canvas>` in the browser **and** re-encoded from pixels via `sharp` on the server to strip 100% of EXIF/GPS metadata).
- **Accessible & personalizable:** English & German (`EN` / `DE`), five WCAG AA-verified themes (`Light`, `Dark`, `Retro terminal`, `Pastel`, `Zürich tram`), and installable as a phone home-screen PWA with offline last-result caching.

---

## Tech Stack

- **App & API:** Next.js 15 (App Router), React 19, TypeScript (strict mode), Tailwind CSS 4
- **Database, Cron & Storage:** Supabase Free (PostgreSQL, Row-Level Security on every table, `pg_cron` + `pg_net` nightly batch triggers, `room-photos` Storage bucket)
- **Maps:** MapLibre GL JS + OpenStreetMap raster tiles
- **Validation & Image Sanitization:** Zod + `sharp`
- **Testing:** Vitest (offline parser, interval, DST, consensus, EXIF/GPS stripping, and WCAG AA contrast unit tests) + Playwright (mobile E2E tests)

---

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and fill in your Supabase project URL, keys, random secrets, and a polite contact `User-Agent`:
   ```bash
   cp .env.example .env.local
   ```

3. **Apply Supabase database migrations:**
   Apply the SQL files in `supabase/migrations/` in order via the Supabase SQL Editor or Supabase CLI:
   - `20261116000001_initial_schema.sql`
   - `20261116000002_nightly_cron_schedule.sql`
   - `20261117000003_contributions_storage.sql`

4. **Seed room & booking data politely:**
   ```bash
   npm run scrape:eth   # Syncs ETH rooms, study spaces, and a polite batch of 7-day schedules
   npm run scrape:uzh   # Syncs UZH 3vrooms 7-day schedules (3 requests total) + 19 UZH study areas
   ```

5. **Run locally:**
   ```bash
   npm run dev
   ```

---

## Quality & Test Commands

```bash
npm run typecheck   # Strict TypeScript check (tsc --noEmit)
npm run lint        # ESLint check
npm test            # Offline Vitest unit test suite
npm run build       # Production Next.js build
npm run test:e2e    # Mobile (390x844) Playwright E2E suite
```

---

## Server Etiquette & Credits

- **Polite, low-volume data access:** Sequential requests only (`>= 1.25–1.5s` apart), 7-day look-ahead per single request, 5-minute server-cached occupancy proxy, and 100% offline unit tests against `fixtures/`. Lecturer and organizer names are dropped immediately before storage.
- **Data sources:** [ETH Rauminfo](https://www.ethz.ch/rooms), [ETH Student Workspaces](https://ethz.ch/students/en/campus/workspaces-for-students/occupancy-student-workspaces.html), [UZH Occupancy Calendar (`3vrooms`)](https://uzh.book.3vrooms.app/default/Anonymous/Calendar/PortalFind), [UZH Student Study Rooms](https://www.campuskultur.uzh.ch/en/campusnutzung-und-bewilligungen/raeume/weitere-raeume/studentische-lernraeume.html), and [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **Inspiration:** Inspired by earlier student projects [`nielstron/freiraumETHZ`](https://github.com/nielstron/freiraumETHZ) and [`benedict-armstrong/ETH_room_viewer`](https://github.com/benedict-armstrong/ETH_room_viewer). All code in this repository is written from scratch.

---

## Licence

Released under the [MIT License](LICENSE).
