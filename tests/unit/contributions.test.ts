import { describe, expect, it } from 'vitest';
import {
  computeLockTrend,
  emptyCommunitySummary,
  getEffectiveDetailValue,
  hashDeviceToken,
  resolveDetailConsensus,
} from '@/lib/contributions';
import { matchesRoomMetadataFilters } from '@/lib/free-rooms';
import { inspectImageBufferMetadata, sanitizeRoomPhotoBuffer } from '@/lib/photo-sanitizer';
import { DetailReportRow, LockReportRow, Room } from '@/types/domain';
import { createTestJpegWithGpsExif } from '../helpers/exif-gps-jpeg';

const sampleUzhRoom: Room = {
  id: 'UZH:KOL-G-201',
  building_id: 'UZH:KOL',
  institution: 'UZH',
  campus: 'Zentrum',
  building_code: 'KOL',
  floor: 'G',
  room_number: '201',
  display_name: 'KOL-G-201',
  room_type: 'lecture_hall',
  source_room_type: 'Hörsaal (UZH)',
  capacity: 280,
  exam_capacity: null,
  official_details: {},
  official_url: 'https://uzh.book.3vrooms.app/default/Anonymous/Calendar/PortalFind',
  live_occupancy_key: null,
  schedule_status: 'ok',
  last_scraped_at: '2026-11-17T07:00:00.000Z',
};

describe('Community Contributions: Consensus, Lock Trend, Feature Filters & EXIF GPS Removal', () => {
  it('resolves 3 devices voting on one detail to the most-reported value', () => {
    const reports: DetailReportRow[] = [
      {
        id: 1,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'many',
        reported_at: '2026-11-17T08:00:00.000Z',
        device_hash: 'device_a',
        hidden: false,
      },
      {
        id: 2,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'few',
        reported_at: '2026-11-17T08:01:00.000Z',
        device_hash: 'device_b',
        hidden: false,
      },
      {
        id: 3,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'many',
        reported_at: '2026-11-17T08:02:00.000Z',
        device_hash: 'device_c',
        hidden: false,
      },
    ];

    const consensus = resolveDetailConsensus(reports);
    expect(consensus.outlets).toMatchObject({
      detailName: 'outlets',
      value: 'many',
      voteCount: 2,
      totalUniqueDevices: 3,
    });
  });

  it('counts only each device latest vote and breaks ties in favour of the most recent report', () => {
    const reports: DetailReportRow[] = [
      // Device A initially voted 'none' twice, then changed mind to 'many' at 08:00
      {
        id: 1,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'none',
        reported_at: '2026-11-17T07:50:00.000Z',
        device_hash: 'device_a',
        hidden: false,
      },
      {
        id: 2,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'none',
        reported_at: '2026-11-17T07:55:00.000Z',
        device_hash: 'device_a',
        hidden: false,
      },
      {
        id: 3,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'many',
        reported_at: '2026-11-17T08:00:00.000Z',
        device_hash: 'device_a',
        hidden: false,
      },
      // Device B voted 'few' at 08:05 -> 1-1 tie between 'many' and 'few'; 'few' is newer
      {
        id: 4,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'few',
        reported_at: '2026-11-17T08:05:00.000Z',
        device_hash: 'device_b',
        hidden: false,
      },
      // Hidden spam vote is ignored
      {
        id: 5,
        room_id: 'UZH:KOL-G-201',
        detail_name: 'outlets',
        detail_value: 'none',
        reported_at: '2026-11-17T08:10:00.000Z',
        device_hash: 'device_spam',
        hidden: true,
      },
    ];

    const consensus = resolveDetailConsensus(reports);
    expect(consensus.outlets).toMatchObject({
      value: 'few',
      voteCount: 1,
      totalUniqueDevices: 2,
    });
  });

  it('keeps small lock-report samples modest (<8 reports) and detects clear time-of-day patterns at 8+ reports', () => {
    const emptyTrend = computeLockTrend([]);
    expect(emptyTrend.totalReports).toBe(0);
    expect(emptyTrend.hasPattern).toBe(false);

    const smallSample: LockReportRow[] = [
      {
        id: 1,
        room_id: 'R1',
        reported_at: '2026-11-16T08:00:00Z',
        is_locked: false,
        device_hash: 'd1',
        hidden: false,
      },
      {
        id: 2,
        room_id: 'R1',
        reported_at: '2026-11-16T09:00:00Z',
        is_locked: true,
        device_hash: 'd2',
        hidden: false,
      },
      {
        id: 3,
        room_id: 'R1',
        reported_at: '2026-11-16T18:00:00Z',
        is_locked: true,
        device_hash: 'd3',
        hidden: false,
      },
      {
        id: 4,
        room_id: 'R1',
        reported_at: '2026-11-16T19:00:00Z',
        is_locked: true,
        device_hash: 'd4',
        hidden: false,
      },
    ];
    const modest = computeLockTrend(smallSample);
    expect(modest.totalReports).toBe(4);
    expect(modest.lockedReports).toBe(3);
    expect(modest.hasPattern).toBe(false);

    // 8 reports: 4 morning in Zurich (09:00 CET = 08:00 UTC, 0/4 locked) vs 4 evening in Zurich (19:00 CET = 18:00 UTC, 4/4 locked)
    const patternSample: LockReportRow[] = [
      {
        id: 1,
        room_id: 'R1',
        reported_at: '2026-11-16T08:00:00Z',
        is_locked: false,
        device_hash: 'd1',
        hidden: false,
      },
      {
        id: 2,
        room_id: 'R1',
        reported_at: '2026-11-16T08:30:00Z',
        is_locked: false,
        device_hash: 'd2',
        hidden: false,
      },
      {
        id: 3,
        room_id: 'R1',
        reported_at: '2026-11-17T09:00:00Z',
        is_locked: false,
        device_hash: 'd3',
        hidden: false,
      },
      {
        id: 4,
        room_id: 'R1',
        reported_at: '2026-11-17T09:30:00Z',
        is_locked: false,
        device_hash: 'd4',
        hidden: false,
      },
      {
        id: 5,
        room_id: 'R1',
        reported_at: '2026-11-16T18:00:00Z',
        is_locked: true,
        device_hash: 'd1',
        hidden: false,
      },
      {
        id: 6,
        room_id: 'R1',
        reported_at: '2026-11-16T18:30:00Z',
        is_locked: true,
        device_hash: 'd2',
        hidden: false,
      },
      {
        id: 7,
        room_id: 'R1',
        reported_at: '2026-11-17T19:00:00Z',
        is_locked: true,
        device_hash: 'd3',
        hidden: false,
      },
      {
        id: 8,
        room_id: 'R1',
        reported_at: '2026-11-17T19:30:00Z',
        is_locked: true,
        device_hash: 'd4',
        hidden: false,
      },
    ];
    const pattern = computeLockTrend(patternSample);
    expect(pattern.hasPattern).toBe(true);
    expect(pattern.patternType).toBe('time_of_day');
    expect(pattern.buckets).toEqual([
      { bucket: 'morning', lockedCount: 0, totalCount: 4, lockedRatio: 0 },
      { bucket: 'evening', lockedCount: 4, totalCount: 4, lockedRatio: 1 },
    ]);
  });

  it('prefers official detail values when available and uses community consensus for filters when missing', () => {
    const community = emptyCommunitySummary();
    community.details.outlets = {
      detailName: 'outlets',
      value: 'many',
      voteCount: 3,
      totalUniqueDevices: 3,
      lastReportedAt: '2026-11-17T08:00:00.000Z',
    };

    // UZH room has no official outlets -> resolves to community 'many'
    expect(getEffectiveDetailValue(sampleUzhRoom, 'outlets', community)).toEqual({
      value: 'many',
      source: 'community',
    });

    expect(
      matchesRoomMetadataFilters(
        sampleUzhRoom,
        {
          mode: 'now',
          nowIso: '2026-11-17T08:00:00.000Z',
          minDurationMinutes: 60,
          requireOutlets: true,
          includeUnknownFeatures: false,
        },
        community
      )
    ).toBe(true);

    // ETH room with official outlets = 'none' overrides any community value
    const officialNoneRoom: Room = {
      ...sampleUzhRoom,
      id: 'ETH:HG D 1',
      official_details: { outlets: 'none' },
    };
    expect(getEffectiveDetailValue(officialNoneRoom, 'outlets', community)).toEqual({
      value: 'none',
      source: 'official',
    });
    expect(
      matchesRoomMetadataFilters(
        officialNoneRoom,
        {
          mode: 'now',
          nowIso: '2026-11-17T08:00:00.000Z',
          minDurationMinutes: 60,
          requireOutlets: true,
          includeUnknownFeatures: false,
        },
        community
      )
    ).toBe(false);
  });

  it('strips 100% of EXIF, GPS coordinates, and camera metadata when re-encoding a photo on the server', async () => {
    const rawWithGps = await createTestJpegWithGpsExif();
    const beforeMeta = await inspectImageBufferMetadata(rawWithGps);

    expect(beforeMeta.format).toBe('jpeg');
    expect(beforeMeta.hasExif).toBe(true);
    expect(beforeMeta.containsExifHeaderBytes).toBe(true);
    expect(rawWithGps.includes(Buffer.from('SecretGPSMarker', 'ascii'))).toBe(true);

    const sanitized = await sanitizeRoomPhotoBuffer(rawWithGps);
    const afterMeta = await inspectImageBufferMetadata(sanitized);

    expect(afterMeta.format).toBe('jpeg');
    expect(afterMeta.hasExif).toBe(false);
    expect(afterMeta.hasXmp).toBe(false);
    expect(afterMeta.hasIptc).toBe(false);
    expect(afterMeta.containsExifHeaderBytes).toBe(false);
    expect(sanitized.includes(Buffer.from('SecretGPSMarker', 'ascii'))).toBe(false);
    expect(sanitized.includes(Buffer.from('TestPhoneCamera', 'ascii'))).toBe(false);
  });

  it('hashes device tokens deterministically without storing raw tokens', () => {
    const h1 = hashDeviceToken('device-token-12345678', 'test-salt');
    const h2 = hashDeviceToken('device-token-12345678', 'test-salt');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).not.toContain('device-token');
  });
});
