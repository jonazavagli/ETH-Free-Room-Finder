import { describe, expect, it } from 'vitest';
import { evaluateFreeRooms } from '@/lib/free-rooms';
import { getZurichDayBounds, zurichLocalToIso } from '@/lib/time';
import { Booking, Room } from '@/types/domain';

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'ETH:HG E 3',
    building_id: 'ETH:HG',
    institution: 'ETH',
    campus: 'Zentrum',
    building_code: 'HG',
    floor: 'E',
    room_number: '3',
    display_name: 'HG E 3',
    room_type: 'lecture_hall',
    source_room_type: 'Hörsaal',
    capacity: 100,
    exam_capacity: 50,
    official_details: {},
    official_url: 'https://ethz.ch/rooms',
    live_occupancy_key: null,
    schedule_status: 'ok',
    last_scraped_at: '2026-11-16T03:00:00.000Z',
    ...overrides,
  };
}

function makeBooking(
  roomId: string,
  dateYYYYMMDD: string,
  startHHMM: string,
  endHHMM: string,
  title = 'Lecture'
): Booking {
  return {
    room_id: roomId,
    start_time: zurichLocalToIso(dateYYYYMMDD, startHHMM),
    end_time: zurichLocalToIso(dateYYYYMMDD, endHHMM),
    title,
    booking_type: 'Lehrveranstaltung',
    source: 'eth_rauminfo',
    scraped_at: '2026-11-16T03:00:00.000Z',
  };
}

describe('Free-Room Logic (Intervals, DST, Midnight, Unknown, Stale)', () => {
  it('enforces half-open intervals: a booking ending at 14:00 does NOT block 14:00', () => {
    const room = makeRoom();
    const bookings = [
      makeBooking(room.id, '2026-11-16', '12:00', '14:00', 'Morning Class'),
      makeBooking(room.id, '2026-11-16', '16:00', '18:00', 'Late Class'),
    ];

    // Query at exactly 14:00 for 2 hours (14:00 to 16:00)
    const result = evaluateFreeRooms([room], bookings, {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-11-16', '14:00'),
      minDurationMinutes: 120,
    });

    expect(result.matchingRooms).toHaveLength(1);
    expect(result.matchingRooms[0]?.freeUntilHHMM).toBe('16:00');
    expect(result.matchingRooms[0]?.freeForRestOfDay).toBe(false);
  });

  it('merges back-to-back bookings with zero gap between them', () => {
    const room = makeRoom();
    const bookings = [
      makeBooking(room.id, '2026-11-16', '10:00', '12:00', 'Part 1'),
      makeBooking(room.id, '2026-11-16', '12:00', '14:00', 'Part 2'),
    ];

    // Searching in window 09:00 - 15:00 for a 90-minute gap should fail (only 60m before 10:00 and 60m after 14:00)
    const failResult = evaluateFreeRooms([room], bookings, {
      mode: 'window',
      nowIso: zurichLocalToIso('2026-11-16', '08:00'),
      windowStartHHMM: '09:00',
      windowEndHHMM: '15:00',
      minDurationMinutes: 90,
    });
    expect(failResult.matchingRooms).toHaveLength(0);

    // Searching in window 08:00 - 17:00 for a 120-minute gap should find [08:00, 10:00) and [14:00, 17:00)
    const passResult = evaluateFreeRooms([room], bookings, {
      mode: 'window',
      nowIso: zurichLocalToIso('2026-11-16', '08:00'),
      windowStartHHMM: '08:00',
      windowEndHHMM: '17:00',
      minDurationMinutes: 120,
    });
    expect(passResult.matchingRooms).toHaveLength(1);
    expect(passResult.matchingRooms[0]?.matchingGaps).toHaveLength(2);
    expect(passResult.matchingRooms[0]?.matchingGaps[0]?.durationMinutes).toBe(120);
    expect(passResult.matchingRooms[0]?.matchingGaps[1]?.durationMinutes).toBe(180);
  });

  it('handles an empty day with no bookings as free for the rest of the day', () => {
    const room = makeRoom();
    const result = evaluateFreeRooms([room], [], {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-11-16', '11:30'),
      minDurationMinutes: 120,
    });

    expect(result.matchingRooms).toHaveLength(1);
    expect(result.matchingRooms[0]?.freeForRestOfDay).toBe(true);
    expect(result.matchingRooms[0]?.freeUntilIso).toBeNull();
    expect(result.matchingRooms[0]?.todayFreeGaps).toHaveLength(1);
    expect(result.matchingRooms[0]?.todayFreeGaps[0]?.durationMinutes).toBe(24 * 60);
  });

  it('handles midnight boundaries accurately in Europe/Zurich', () => {
    const room = makeRoom();
    const bookings = [makeBooking(room.id, '2026-11-16', '22:00', '24:00', 'Late Maintenance')];

    const lateQuery = evaluateFreeRooms([room], bookings, {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-11-16', '20:00'),
      minDurationMinutes: 120,
    });
    expect(lateQuery.matchingRooms).toHaveLength(1);
    expect(lateQuery.matchingRooms[0]?.freeUntilHHMM).toBe('22:00');
  });

  it('covers both Europe/Zurich Daylight-Saving Time (DST) transition days', () => {
    // 1. Spring forward day: Sunday 2026-03-29 (clocks jump 02:00 CET -> 03:00 CEST, 23-hour day)
    const springBounds = getZurichDayBounds('2026-03-29');
    expect((springBounds.dayEndMs - springBounds.dayStartMs) / 3600_000).toBe(23);

    const springRoom = makeRoom({ last_scraped_at: '2026-03-29T01:00:00.000Z' });
    const springBookings = [
      makeBooking(springRoom.id, '2026-03-29', '10:00', '12:00', 'Spring Seminar'),
    ];
    const springRes = evaluateFreeRooms([springRoom], springBookings, {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-03-29', '08:00'),
      minDurationMinutes: 120,
    });
    expect(springRes.matchingRooms).toHaveLength(1);
    expect(springRes.matchingRooms[0]?.freeUntilHHMM).toBe('10:00');

    // 2. Fall back day: Sunday 2026-10-25 (clocks jump back 03:00 CEST -> 02:00 CET, 25-hour day)
    const fallBounds = getZurichDayBounds('2026-10-25');
    expect((fallBounds.dayEndMs - fallBounds.dayStartMs) / 3600_000).toBe(25);

    const fallRoom = makeRoom({ last_scraped_at: '2026-10-25T01:00:00.000Z' });
    const fallBookings = [
      makeBooking(fallRoom.id, '2026-10-25', '14:00', '16:00', 'Autumn Seminar'),
    ];
    const fallRes = evaluateFreeRooms([fallRoom], fallBookings, {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-10-25', '12:00'),
      minDurationMinutes: 120,
    });
    expect(fallRes.matchingRooms).toHaveLength(1);
    expect(fallRes.matchingRooms[0]?.freeUntilHHMM).toBe('14:00');
  });

  it('never shows an unknown-schedule room as free and groups it under unknownScheduleRooms', () => {
    const unknownRoom = makeRoom({
      id: 'ETH:CAB G 51',
      display_name: 'CAB G 51',
      schedule_status: 'unknown',
      last_scraped_at: null,
    });
    const okRoom = makeRoom({
      id: 'ETH:HG E 3',
      display_name: 'HG E 3',
      schedule_status: 'ok',
    });

    const result = evaluateFreeRooms([unknownRoom, okRoom], [], {
      mode: 'now',
      nowIso: zurichLocalToIso('2026-11-16', '10:00'),
      minDurationMinutes: 120,
    });

    expect(result.matchingRooms).toHaveLength(1);
    expect(result.matchingRooms[0]?.room.id).toBe('ETH:HG E 3');
    expect(result.unknownScheduleRooms).toHaveLength(1);
    expect(result.unknownScheduleRooms[0]?.room.id).toBe('ETH:CAB G 51');
    expect(result.unknownScheduleRooms[0]?.matchesTime).toBe(false);
  });

  it('flags stale data when last_scraped_at is older than 36 hours', () => {
    const staleRoom = makeRoom({
      // 40 hours before 2026-11-16T15:00:00Z
      last_scraped_at: '2026-11-14T22:00:00.000Z',
    });

    const result = evaluateFreeRooms([staleRoom], [], {
      mode: 'now',
      nowIso: '2026-11-16T15:00:00.000Z',
      minDurationMinutes: 60,
    });

    expect(result.hasStaleData).toBe(true);
    expect(result.matchingRooms[0]?.isStale).toBe(true);
  });
});
