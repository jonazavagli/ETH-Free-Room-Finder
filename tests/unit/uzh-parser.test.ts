import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseUzh3vroomsCalendarPayload,
  parseUzh3vroomsTitle,
  parseUzhStudyRoomsPayload,
} from '@/lib/scrapers/uzh';

const fixturesDir = path.resolve(__dirname, '../../fixtures');

describe('UZH 3vrooms & Study Areas Parser (Offline Fixture Tests)', () => {
  it('parses UZH 3vrooms room titles and capacities accurately', () => {
    expect(parseUzh3vroomsTitle('HAH-E-03 (442 Plätze)')).toMatchObject({
      displayName: 'HAH-E-03',
      buildingCode: 'HAH',
      floor: 'E',
      roomNumber: '03',
      capacity: 442,
      roomType: 'lecture_hall',
      isExcludedSurface: false,
    });

    expect(parseUzh3vroomsTitle('KOL-G-201 Aula (280 / mit Emporen 359 Plätze ) **')).toMatchObject(
      {
        displayName: 'KOL-G-201',
        buildingCode: 'KOL',
        floor: 'G',
        roomNumber: '201',
        capacity: 280,
        roomType: 'lecture_hall',
        isExcludedSurface: false,
      }
    );

    expect(parseUzh3vroomsTitle('KAB-G-01 Apérofläche (90 Plätze)')).toMatchObject({
      isExcludedSurface: true,
    });
  });

  it('parses real uzh-3vrooms-calendar-sample.json fixture and converts wall-clock time to Europe/Zurich', () => {
    const rawText = fs.readFileSync(
      path.join(fixturesDir, 'uzh-3vrooms-calendar-sample.json'),
      'utf-8'
    );
    const rawJson: unknown = JSON.parse(rawText);

    const { buildings, rooms, bookingsByRoomId } = parseUzh3vroomsCalendarPayload(
      rawJson,
      'Zentrum',
      '2026-11-16T03:00:00.000Z'
    );

    expect(rooms.length).toBe(5);
    expect(buildings.length).toBeGreaterThanOrEqual(4);

    const kolAula = rooms.find((r) => r.display_name === 'KOL-G-201');
    expect(kolAula).toBeDefined();
    expect(kolAula?.capacity).toBe(280);
    expect(kolAula?.institution).toBe('UZH');

    const kolBookings = bookingsByRoomId.get('UZH:KOL-G-201') ?? [];
    expect(kolBookings.length).toBeGreaterThan(0);

    // Verify 10:15 - 12:00 Europe/Zurich on 2026-11-16 (CET +01:00 -> 09:15 - 11:00 UTC)
    const morningSlot = kolBookings.find((b) => b.start_time === '2026-11-16T09:15:00.000Z');
    expect(morningSlot).toBeDefined();
    expect(morningSlot?.end_time).toBe('2026-11-16T11:00:00.000Z');
  });

  it('parses real uzh-study-rooms.json fixture into 19 always_open UZH study spaces', () => {
    const rawText = fs.readFileSync(path.join(fixturesDir, 'uzh-study-rooms.json'), 'utf-8');
    const rawJson: unknown = JSON.parse(rawText);

    const { rooms, buildings } = parseUzhStudyRoomsPayload(rawJson);

    expect(rooms).toHaveLength(19);
    expect(buildings.length).toBeGreaterThanOrEqual(8);
    expect(rooms.every((r) => r.institution === 'UZH')).toBe(true);
    expect(rooms.every((r) => r.room_type === 'study_space')).toBe(true);
    expect(rooms.every((r) => r.schedule_status === 'always_open')).toBe(true);
  });

  it('fails loudly when UZH payload schema changes incompatibly', () => {
    expect(() =>
      parseUzh3vroomsCalendarPayload({ wrongKey: [] }, 'Zentrum', '2026-11-16T03:00:00.000Z')
    ).toThrow();
  });
});
