import {
  Booking,
  Building,
  EvaluatedRoom,
  FreeRoomQuery,
  FreeRoomsSearchResult,
  Room,
  RoomCommunitySummary,
  TimeInterval,
} from '@/types/domain';
import { getEffectiveDetailValue } from './contributions';
import { getZurichDayBounds, getZurichHHMM, zurichLocalToUtcMs } from './time';

export const STALE_THRESHOLD_HOURS = 36;
export const STALE_THRESHOLD_MS = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

interface RawMsInterval {
  startMs: number;
  endMs: number;
}

/**
 * Merges overlapping or back-to-back half-open intervals [startMs, endMs).
 * Because [a, b) and [b, c) have zero free time at b, they merge into [a, c).
 */
export function mergeBusyIntervals(intervals: RawMsInterval[]): RawMsInterval[] {
  const valid = intervals
    .filter((i) => i.endMs > i.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const merged: RawMsInterval[] = [];
  for (const current of valid) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...current });
    } else if (current.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, current.endMs);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/**
 * Computes free gaps within [windowStartMs, windowEndMs) given merged busy intervals.
 */
export function computeFreeGapsInWindow(
  windowStartMs: number,
  windowEndMs: number,
  mergedBusy: RawMsInterval[]
): TimeInterval[] {
  if (windowEndMs <= windowStartMs) {
    return [];
  }

  const gaps: TimeInterval[] = [];
  let cursor = windowStartMs;

  for (const busy of mergedBusy) {
    if (busy.endMs <= cursor) {
      continue;
    }
    if (busy.startMs >= windowEndMs) {
      break;
    }
    if (busy.startMs > cursor) {
      const gapEnd = Math.min(busy.startMs, windowEndMs);
      gaps.push(toTimeInterval(cursor, gapEnd));
    }
    cursor = Math.max(cursor, busy.endMs);
    if (cursor >= windowEndMs) {
      break;
    }
  }

  if (cursor < windowEndMs) {
    gaps.push(toTimeInterval(cursor, windowEndMs));
  }

  return gaps;
}

function toTimeInterval(startMs: number, endMs: number): TimeInterval {
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    durationMinutes: Math.round((endMs - startMs) / 60_000),
  };
}

/**
 * Checks whether a room passes the non-time attribute filters (institution, campus, building,
 * room_type, capacity, outlets, board, quiet, wheelchair) using official + community details.
 */
export function matchesRoomMetadataFilters(
  room: Room,
  query: FreeRoomQuery,
  community?: RoomCommunitySummary | null
): boolean {
  if (query.institutions && query.institutions.length > 0) {
    if (!query.institutions.includes(room.institution)) {
      return false;
    }
  }

  if (query.campuses && query.campuses.length > 0) {
    if (!query.campuses.includes(room.campus)) {
      return false;
    }
  }

  if (query.buildingCodes && query.buildingCodes.length > 0) {
    if (!query.buildingCodes.includes(room.building_code)) {
      return false;
    }
  }

  if (query.roomTypes && query.roomTypes.length > 0) {
    if (!query.roomTypes.includes(room.room_type)) {
      return false;
    }
  }

  if (query.minCapacity !== undefined && query.minCapacity > 0) {
    if (room.capacity === null || room.capacity === undefined) {
      if (!query.includeUnknownCapacity) {
        return false;
      }
    } else if (room.capacity < query.minCapacity) {
      return false;
    }
  }

  const includeUnknownFeatures = query.includeUnknownFeatures ?? true;

  if (query.requireOutlets) {
    const outlets = getEffectiveDetailValue(room, 'outlets', community).value;
    if (!outlets) {
      if (!includeUnknownFeatures) return false;
    } else if (outlets === 'none') {
      return false;
    }
  }

  if (query.requireBoard) {
    const board = getEffectiveDetailValue(room, 'board', community).value;
    if (!board) {
      if (!includeUnknownFeatures) return false;
    } else if (board === 'none') {
      return false;
    }
  }

  if (query.requireQuiet) {
    const noise = getEffectiveDetailValue(room, 'noise', community).value;
    if (!noise) {
      if (!includeUnknownFeatures) return false;
    } else if (noise !== 'quiet') {
      return false;
    }
  }

  if (query.requireWheelchair) {
    const wc = room.official_details.wheelchair;
    if (wc === undefined) {
      if (!includeUnknownFeatures) return false;
    } else if (!wc) {
      return false;
    }
  }

  return true;
}

/**
 * Pure function that evaluates a list of rooms and bookings against a FreeRoomQuery.
 */
export function evaluateFreeRooms(
  rooms: Room[],
  bookings: Booking[],
  query: FreeRoomQuery,
  buildingsById?: Map<string, Building>,
  communitySummariesByRoomId?: Record<string, RoomCommunitySummary>
): FreeRoomsSearchResult {
  const nowMs = Date.parse(query.nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`Invalid query.nowIso: "${query.nowIso}"`);
  }

  const dayBounds = getZurichDayBounds(nowMs);
  const { dateYYYYMMDD, dayStartMs, dayEndMs } = dayBounds;

  const minDurationMs = Math.max(0, query.minDurationMinutes) * 60_000;

  let windowStartMs = nowMs;
  let windowEndMs = nowMs + minDurationMs;

  if (query.mode === 'window') {
    const startHHMM = query.windowStartHHMM ?? '08:00';
    const endHHMM = query.windowEndHHMM ?? '18:00';
    windowStartMs = zurichLocalToUtcMs(dateYYYYMMDD, startHHMM);
    windowEndMs = zurichLocalToUtcMs(dateYYYYMMDD, endHHMM);
  }

  // Group bookings by room_id that overlap today [dayStartMs, dayEndMs)
  const bookingsByRoom = new Map<string, Booking[]>();
  for (const b of bookings) {
    const bStart = Date.parse(b.start_time);
    const bEnd = Date.parse(b.end_time);
    if (Number.isNaN(bStart) || Number.isNaN(bEnd) || bEnd <= bStart) {
      continue;
    }
    // Half-open overlap with [dayStartMs, dayEndMs)
    if (bStart < dayEndMs && dayStartMs < bEnd) {
      const list = bookingsByRoom.get(b.room_id);
      if (list) {
        list.push(b);
      } else {
        bookingsByRoom.set(b.room_id, [b]);
      }
    }
  }

  const matchingRooms: EvaluatedRoom[] = [];
  const unknownScheduleRooms: EvaluatedRoom[] = [];
  let hasStaleData = false;
  let oldestScrapeMs: number | null = null;

  for (const room of rooms) {
    const roomCommunity = communitySummariesByRoomId?.[room.id] ?? null;
    if (!matchesRoomMetadataFilters(room, query, roomCommunity)) {
      continue;
    }

    const roomBookings = (bookingsByRoom.get(room.id) ?? []).sort(
      (a, b) => Date.parse(a.start_time) - Date.parse(b.start_time)
    );

    // Check data staleness (> 36 hours old)
    let isStale = false;
    if (room.schedule_status === 'ok') {
      if (room.last_scraped_at) {
        const scrapedMs = Date.parse(room.last_scraped_at);
        if (!Number.isNaN(scrapedMs)) {
          if (nowMs - scrapedMs > STALE_THRESHOLD_MS) {
            isStale = true;
            hasStaleData = true;
          }
          if (oldestScrapeMs === null || scrapedMs < oldestScrapeMs) {
            oldestScrapeMs = scrapedMs;
          }
        }
      } else {
        isStale = true;
        hasStaleData = true;
      }
    }

    const building = buildingsById?.get(room.building_id);

    // Rule: Unknown is NEVER free and NEVER hidden
    if (room.schedule_status === 'unknown') {
      unknownScheduleRooms.push({
        room,
        building,
        isUnknownSchedule: true,
        matchesTime: false,
        freeUntilIso: null,
        freeUntilHHMM: null,
        freeForRestOfDay: false,
        matchingGaps: [],
        todayBookings: roomBookings,
        todayFreeGaps: [],
        isStale,
      });
      continue;
    }

    // Clip bookings to today's bounds [dayStartMs, dayEndMs) for timeline & gap analysis
    const rawIntervals: RawMsInterval[] =
      room.schedule_status === 'always_open'
        ? []
        : roomBookings.map((b) => ({
            startMs: Math.max(dayStartMs, Date.parse(b.start_time)),
            endMs: Math.min(dayEndMs, Date.parse(b.end_time)),
          }));

    const mergedBusy = mergeBusyIntervals(rawIntervals);
    const todayFreeGaps = computeFreeGapsInWindow(dayStartMs, dayEndMs, mergedBusy);

    if (query.mode === 'now') {
      const targetEndMs = nowMs + minDurationMs;
      // Check if any booking overlaps [nowMs, targetEndMs)
      // Note: We check against unclipped roomBookings as well in case targetEndMs crosses midnight
      const overlapsRequiredWindow =
        room.schedule_status === 'always_open'
          ? false
          : roomBookings.some((b) => {
              const bStart = Date.parse(b.start_time);
              const bEnd = Date.parse(b.end_time);
              return bStart < targetEndMs && nowMs < bEnd;
            });

      if (overlapsRequiredWindow) {
        continue;
      }

      // Find when the next booking today starts after nowMs
      const nextBusy = mergedBusy.find((b) => b.endMs > nowMs);
      const freeForRestOfDay = !nextBusy || nextBusy.startMs >= dayEndMs;
      const freeUntilMs = freeForRestOfDay ? dayEndMs : nextBusy.startMs;
      const freeUntilIso = freeForRestOfDay ? null : new Date(freeUntilMs).toISOString();
      const freeUntilHHMM = freeForRestOfDay ? null : getZurichHHMM(freeUntilMs);

      const currentGap: TimeInterval = {
        startMs: nowMs,
        endMs: Math.max(nowMs, freeUntilMs),
        startIso: new Date(nowMs).toISOString(),
        endIso: new Date(Math.max(nowMs, freeUntilMs)).toISOString(),
        durationMinutes: Math.round(Math.max(0, freeUntilMs - nowMs) / 60_000),
      };

      matchingRooms.push({
        room,
        building,
        isUnknownSchedule: false,
        matchesTime: true,
        freeUntilIso,
        freeUntilHHMM,
        freeForRestOfDay,
        matchingGaps: [currentGap],
        todayBookings: roomBookings,
        todayFreeGaps,
        isStale,
      });
    } else {
      // mode === 'window'
      const gapsInWindow = computeFreeGapsInWindow(windowStartMs, windowEndMs, mergedBusy);
      const qualifyingGaps = gapsInWindow.filter((g) => g.endMs - g.startMs >= minDurationMs);

      if (qualifyingGaps.length === 0) {
        continue;
      }

      const firstGap = qualifyingGaps[0]!;
      // Find when the next booking on the full day starts at or after firstGap.startMs
      const nextBusyOnDay = mergedBusy.find((b) => b.startMs >= firstGap.endMs);
      const freeForRestOfDay =
        !nextBusyOnDay &&
        firstGap.endMs >= windowEndMs &&
        !mergedBusy.some((b) => b.startMs >= firstGap.startMs);
      const nextBookingStartMs = nextBusyOnDay
        ? nextBusyOnDay.startMs
        : (mergedBusy.find((b) => b.startMs >= firstGap.startMs)?.startMs ?? null);

      const isRestOfDay = nextBookingStartMs === null || nextBookingStartMs >= dayEndMs;
      const freeUntilIso = isRestOfDay ? null : new Date(nextBookingStartMs).toISOString();
      const freeUntilHHMM = isRestOfDay ? null : getZurichHHMM(nextBookingStartMs);

      matchingRooms.push({
        room,
        building,
        isUnknownSchedule: false,
        matchesTime: true,
        freeUntilIso: freeForRestOfDay ? null : freeUntilIso,
        freeUntilHHMM: freeForRestOfDay ? null : freeUntilHHMM,
        freeForRestOfDay: isRestOfDay,
        matchingGaps: qualifyingGaps,
        todayBookings: roomBookings,
        todayFreeGaps,
        isStale,
      });
    }
  }

  // Sort matching rooms by building_code, then display_name
  matchingRooms.sort((a, b) =>
    a.room.display_name.localeCompare(b.room.display_name, 'de-CH', { numeric: true })
  );
  unknownScheduleRooms.sort((a, b) =>
    a.room.display_name.localeCompare(b.room.display_name, 'de-CH', { numeric: true })
  );

  return {
    matchingRooms,
    unknownScheduleRooms,
    hasStaleData,
    oldestScrapeIso: oldestScrapeMs !== null ? new Date(oldestScrapeMs).toISOString() : null,
    zurichDateYYYYMMDD: dateYYYYMMDD,
    evaluatedAtIso: new Date(nowMs).toISOString(),
  };
}
