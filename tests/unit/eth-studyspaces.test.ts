import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseEthStudySpacesAvailability,
  splitStudySpaceGlobalId,
} from '@/lib/scrapers/eth-studyspaces';

const fixturesDir = path.resolve(__dirname, '../../fixtures');

describe('ETH Study Spaces & Live Occupancy Parser (Offline Fixture Tests)', () => {
  it('splits compact roomGlobalIdentifier strings accurately', () => {
    expect(splitStudySpaceGlobalId('CABF31', 'F')).toEqual({
      buildingCode: 'CAB',
      floor: 'F',
      roomNumber: '31',
      displayName: 'CAB F 31',
    });

    expect(splitStudySpaceGlobalId('HGEO27.1', 'EO')).toEqual({
      buildingCode: 'HG',
      floor: 'EO',
      roomNumber: '27.1',
      displayName: 'HG EO 27.1',
    });

    expect(splitStudySpaceGlobalId('HILE2.1', 'E')).toEqual({
      buildingCode: 'HIL',
      floor: 'E',
      roomNumber: '2.1',
      displayName: 'HIL E 2.1',
    });
  });

  it('parses real eth-studyspaces-availability.json fixture into live occupancy items and study space rooms', () => {
    const rawText = fs.readFileSync(
      path.join(fixturesDir, 'eth-studyspaces-availability.json'),
      'utf-8'
    );
    const rawJson: unknown = JSON.parse(rawText);

    const { occupancyItems, rooms, buildings } = parseEthStudySpacesAvailability(rawJson);

    expect(occupancyItems).toHaveLength(6);
    expect(rooms).toHaveLength(6);
    expect(buildings.length).toBeGreaterThanOrEqual(4);

    const cabF31Occ = occupancyItems.find((o) => o.key === 'CABF31');
    expect(cabF31Occ).toMatchObject({
      key: 'CABF31',
      status: 'red',
      occupancyPercentage: 100,
      occupiedSeats: 24,
      maxSeats: 24,
      trend: 'steady',
    });

    const cabF31Room = rooms.find((r) => r.live_occupancy_key === 'CABF31');
    expect(cabF31Room).toMatchObject({
      id: 'ETH:CAB F 31',
      building_id: 'ETH:CAB',
      campus: 'Zentrum',
      display_name: 'CAB F 31',
      room_type: 'study_space',
      capacity: 24,
      schedule_status: 'always_open',
      live_occupancy_key: 'CABF31',
    });
  });

  it('fails loudly on invalid availability JSON structure', () => {
    expect(() => parseEthStudySpacesAvailability({ data: [{ wrong: true }] })).toThrow();
  });
});
