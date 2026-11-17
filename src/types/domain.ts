export type Institution = 'ETH' | 'UZH';

export type RoomType = 'lecture_hall' | 'seminar_room' | 'study_space' | 'computer_room' | 'other';

export type ScheduleStatus = 'ok' | 'always_open' | 'unknown';

export type DetailName = 'outlets' | 'board' | 'desk_type' | 'lighting' | 'noise';

export interface OfficialPhoto {
  url: string;
  alt: string | null;
}

export interface Building {
  id: string; // e.g. 'ETH:HG'
  institution: Institution;
  campus: string; // e.g. 'Zentrum', 'Hönggerberg'
  code: string; // e.g. 'HG'
  name: string; // e.g. 'Hauptgebäude'
  address: string | null;
  lat: number | null;
  lng: number | null;
  official_map_url: string | null;
}

export interface RoomOfficialDetails {
  outlets?: 'many' | 'few' | 'none' | string;
  board?: 'blackboard' | 'whiteboard' | 'both' | 'none' | string;
  desk_type?: 'fixed' | 'large_tables' | 'foldable' | string;
  lighting?: 'bright_daylight' | 'artificial' | 'dim' | string;
  noise?: 'quiet' | 'moderate' | 'lively' | string;
  projector?: boolean;
  wheelchair?: boolean;
  quiet_area?: boolean;
  opening_hours?: string;
  multimedia?: string[];
  equipment?: string[];
  additional_seats?: number;
  study_area_name?: string;
  official_photos?: OfficialPhoto[];
  official_photos_checked?: boolean;
}

export interface LiveOccupancyItem {
  key: string; // e.g. 'CABF31'
  status: 'green' | 'yellow' | 'red' | 'unknown';
  occupancyPercentage: number | null; // 0, 20, 40, 60, 80, 100
  occupiedSeats: number | null;
  maxSeats: number | null;
  trend: 'steady' | 'filling' | 'emptying' | string | null;
  timestampIso: string | null;
}

export interface Room {
  id: string; // e.g. 'ETH:HG E 3'
  building_id: string; // e.g. 'ETH:HG'
  institution: Institution;
  campus: string;
  building_code: string;
  floor: string;
  room_number: string;
  display_name: string; // Exact source room name, e.g. 'HG E 3'
  room_type: RoomType;
  source_room_type: string; // Raw type from source, e.g. 'Hörsaal'
  capacity: number | null;
  exam_capacity: number | null;
  official_details: RoomOfficialDetails;
  official_url: string | null;
  live_occupancy_key: string | null;
  schedule_status: ScheduleStatus;
  last_scraped_at: string | null;
}

export interface Booking {
  id?: number;
  room_id: string;
  start_time: string; // ISO 8601 timestamp with timezone
  end_time: string; // ISO 8601 timestamp with timezone
  title: string;
  booking_type: string | null;
  source: string;
  scraped_at: string;
}

export interface LockReportRow {
  id: number;
  room_id: string;
  reported_at: string;
  is_locked: boolean;
  device_hash: string;
  hidden: boolean;
}

export interface DetailReportRow {
  id: number;
  room_id: string;
  detail_name: DetailName;
  detail_value: string;
  reported_at: string;
  device_hash: string;
  hidden: boolean;
}

export interface CommunityPhotoItem {
  id: number;
  room_id: string;
  url: string;
  uploaded_at: string;
}

export type LockBucketKey = 'morning' | 'afternoon' | 'evening' | 'weekday' | 'weekend';

export interface LockTrendBucketSummary {
  bucket: LockBucketKey;
  lockedCount: number;
  totalCount: number;
  lockedRatio: number;
}

export interface LockTrendSummary {
  totalReports: number;
  lockedReports: number;
  hasPattern: boolean;
  patternType: 'time_of_day' | 'day_type' | null;
  buckets: LockTrendBucketSummary[];
  lastReportedAt: string | null;
}

export interface DetailConsensusItem {
  detailName: DetailName;
  value: string | null;
  voteCount: number;
  totalUniqueDevices: number;
  lastReportedAt: string | null;
}

export interface RoomCommunitySummary {
  lockTrend: LockTrendSummary;
  details: Partial<Record<DetailName, DetailConsensusItem>>;
  photoCount: number;
}

export interface TimeInterval {
  startMs: number;
  endMs: number;
  startIso: string;
  endIso: string;
  durationMinutes: number;
}

export interface FreeRoomQuery {
  mode: 'now' | 'window';
  nowIso: string; // Current time in ISO 8601
  windowStartHHMM?: string; // e.g. '10:00' in Europe/Zurich on the current day
  windowEndHHMM?: string; // e.g. '16:00' in Europe/Zurich on the current day
  minDurationMinutes: number; // e.g. 120 for 2 hours
  institutions?: Institution[];
  campuses?: string[];
  buildingCodes?: string[];
  roomTypes?: RoomType[];
  minCapacity?: number;
  includeUnknownCapacity?: boolean;
  requireOutlets?: boolean;
  requireBoard?: boolean;
  requireQuiet?: boolean;
  requireWheelchair?: boolean;
  includeUnknownFeatures?: boolean;
}

export interface EvaluatedRoom {
  room: Room;
  building?: Building;
  isUnknownSchedule: boolean;
  matchesTime: boolean;
  freeUntilIso: string | null; // null if free for the rest of the day
  freeUntilHHMM: string | null; // Formatted in Europe/Zurich, or null if rest of day
  freeForRestOfDay: boolean;
  matchingGaps: TimeInterval[];
  todayBookings: Booking[];
  todayFreeGaps: TimeInterval[];
  isStale: boolean;
}

export interface FreeRoomsSearchResult {
  matchingRooms: EvaluatedRoom[];
  unknownScheduleRooms: EvaluatedRoom[];
  hasStaleData: boolean;
  oldestScrapeIso: string | null;
  zurichDateYYYYMMDD: string;
  evaluatedAtIso: string;
}
