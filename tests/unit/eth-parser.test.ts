import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseEthAllocationsPayload,
  parseEthRoomDetailPayload,
  parseEthRoomsPayload,
} from '@/lib/scrapers/eth';

const fixturesDir = path.resolve(__dirname, '../../fixtures');

describe('ETH Rauminfo Parser (Offline Fixture Tests)', () => {
  it('parses real ETH /v2/rooms fixture and extracts building + teaching room metadata', () => {
    const rawText = fs.readFileSync(path.join(fixturesDir, 'eth-rooms-sample.json'), 'utf-8');
    const rawJson: unknown = JSON.parse(rawText);

    const { buildings, rooms } = parseEthRoomsPayload(rawJson);

    expect(buildings).toHaveLength(1);
    expect(buildings[0]).toMatchObject({
      id: 'ETH:HIL',
      institution: 'ETH',
      campus: 'Hönggerberg',
      code: 'HIL',
      lat: 47.40833,
      lng: 8.50678,
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      id: 'ETH:HIL E 3',
      building_id: 'ETH:HIL',
      institution: 'ETH',
      campus: 'Hönggerberg',
      building_code: 'HIL',
      floor: 'E',
      room_number: '3',
      display_name: 'HIL E 3',
      room_type: 'lecture_hall',
      source_room_type: 'Hörsaal',
      capacity: 256,
      schedule_status: 'unknown',
    });
  });

  it('parses real ETH allocations fixture, converts Europe/Zurich time, and never stores lecturer names', () => {
    const rawText = fs.readFileSync(path.join(fixturesDir, 'eth-allocations-hg-e-3.json'), 'utf-8');
    const rawJson: unknown = JSON.parse(rawText);

    const bookings = parseEthAllocationsPayload(rawJson, 'ETH:HG E 3', '2026-11-16T02:15:00.000Z');

    expect(bookings).toHaveLength(3);

    // Third item is 2026-11-16 10:00 - 12:00 Europe/Zurich (CET = +01:00 -> 09:00 - 11:00 UTC)
    const mechanik = bookings.find((b) => b.title === 'Mechanik I');
    expect(mechanik).toBeDefined();
    expect(mechanik?.start_time).toBe('2026-11-16T09:00:00.000Z');
    expect(mechanik?.end_time).toBe('2026-11-16T11:00:00.000Z');
    expect(mechanik?.booking_type).toBe('Lehrveranstaltung');

    // Ensure no organizer/lecturer field exists on Booking objects
    for (const b of bookings) {
      expect(Object.keys(b)).not.toContain('veranstalter');
      expect(Object.keys(b)).not.toContain('organizer');
    }
  });

  it('skips cancelled events where findetStatt === 0', () => {
    const payload = [
      {
        veranstaltungsort: '365',
        date_from: '2026-11-16T14:00:00',
        date_to: '2026-11-16T16:00:00',
        belegungsserie: {
          belegungsserie: '999',
          belegungstyp: 2,
          veranstaltung: {
            allocationTitle: 'Cancelled Lecture',
            veranstaltungstyp: 'Lehrveranstaltung',
            findetStatt: 0,
          },
        },
      },
    ];

    const bookings = parseEthAllocationsPayload(payload, 'ETH:HG E 3', '2026-11-16T02:15:00.000Z');
    expect(bookings).toHaveLength(0);
  });

  it('fails loudly when upstream source format changes incompatibly', () => {
    const brokenRoomsPayload = [{ unexpectedField: 123 }];
    expect(() => parseEthRoomsPayload(brokenRoomsPayload)).toThrow();

    const brokenAllocationsPayload = [{ wrongStartKey: '2026-11-16' }];
    expect(() =>
      parseEthAllocationsPayload(brokenAllocationsPayload, 'ETH:HG E 3', '2026-11-16T02:15:00.000Z')
    ).toThrow();
  });

  it('parses official ETH room detail & photo URLs from /v2/rooms/HG E 3 fixture without copying images', () => {
    const rawText = fs.readFileSync(path.join(fixturesDir, 'eth-room-detail-hg-e-3.json'), 'utf-8');
    const rawJson: unknown = JSON.parse(rawText);

    const details = parseEthRoomDetailPayload(rawJson);

    expect(details.official_photos_checked).toBe(true);
    expect(details.is_departmental_room).toBe(false);
    expect(details.outlets).toBe('few');
    expect(details.board).toBe('blackboard');
    expect(details.desk_type).toBe('fixed');
    expect(details.lighting).toBe('artificial');
    expect(details.wheelchair).toBe(true);
    expect(details.noise).toBeUndefined();

    expect(details.official_photos).toHaveLength(6);
    expect(details.official_photos?.[0]?.url).toBe(
      'https://ethz.ch/bin/ethz/roominfo?path=/v2/files/650301'
    );
    expect(details.official_photos?.[0]?.alt).toContain('Vorlesungssaal');

    const deptSample = {
      id: 'HG G 019.1',
      rectorateResponsibility: '0',
      responsible: { unit: 'Departement Mathematik' },
      tabs: [],
    };
    const deptDetails = parseEthRoomDetailPayload(deptSample);
    expect(deptDetails.is_departmental_room).toBe(true);
    expect(deptDetails.managing_department).toBe('Departement Mathematik');
  });

  it('assigns coordinates to RZ, HIF, and Y17 buildings and normalizes Zürich Universität to Irchel', () => {
    const sample = [
      {
        id: 'RZ F 21',
        building: 'RZ',
        floor: 'F',
        room: '21',
        seats: 36,
        type: 'Seminarraum',
        locationName: 'Zürich Zentrum',
      },
      {
        id: 'Y17 M 05',
        building: 'Y17',
        floor: 'M',
        room: '05',
        seats: 120,
        type: 'Hörsaal',
        locationName: 'Zürich Universität',
      },
    ];
    const { buildings, rooms } = parseEthRoomsPayload(sample);
    const rz = buildings.find((b) => b.code === 'RZ');
    const y17 = buildings.find((b) => b.code === 'Y17');
    expect(rz?.lat).not.toBeNull();
    expect(rz?.lng).not.toBeNull();
    expect(y17?.campus).toBe('Irchel');
    expect(y17?.lat).not.toBeNull();
    expect(rooms.find((r) => r.building_code === 'Y17')?.campus).toBe('Irchel');
  });
});
