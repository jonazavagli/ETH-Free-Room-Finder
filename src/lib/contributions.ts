import crypto from 'crypto';
import {
  DetailConsensusItem,
  DetailName,
  DetailReportRow,
  LockBucketKey,
  LockReportRow,
  LockTrendBucketSummary,
  LockTrendSummary,
  Room,
  RoomCommunitySummary,
} from '@/types/domain';

export const DETAIL_ALLOWED_VALUES: Record<DetailName, readonly string[]> = {
  outlets: ['many', 'few', 'none'],
  board: ['blackboard', 'whiteboard', 'both', 'none'],
  desk_type: ['fixed', 'large_tables', 'foldable'],
  lighting: ['bright_daylight', 'artificial', 'dim'],
  noise: ['quiet', 'moderate', 'lively'],
};

export const ALL_DETAIL_NAMES: DetailName[] = [
  'outlets',
  'board',
  'desk_type',
  'lighting',
  'noise',
];

export const LOCK_TREND_MIN_TOTAL = 8;
export const LOCK_TREND_MIN_PER_BUCKET = 3;
export const LOCK_TREND_MIN_DIFF = 0.3; // 30 percentage points

/**
 * Hashes an anonymous browser device token with a server-side secret salt.
 * Only the resulting hex digest is ever persisted in Postgres.
 */
export function hashDeviceToken(deviceToken: string, salt?: string): string {
  const trimmed = deviceToken.trim();
  if (trimmed.length < 12 || trimmed.length > 128) {
    throw new Error('Invalid device token length');
  }
  const effectiveSalt = salt ?? process.env.DEVICE_HASH_SALT ?? 'frf-fallback-dev-salt';
  return crypto.createHash('sha256').update(`${effectiveSalt}:${trimmed}`).digest('hex');
}

/**
 * Checks whether a room already has an authoritative official value for `detailName`.
 * When an official value exists, the UI displays it directly and hides community voting for that detail.
 */
export function getOfficialDetailValue(room: Room, detailName: DetailName): string | null {
  const od = room.official_details;
  if (detailName === 'outlets' && od.outlets) return od.outlets;
  if (detailName === 'board' && od.board) return od.board;
  if (detailName === 'desk_type' && od.desk_type) return od.desk_type;
  if (detailName === 'lighting' && od.lighting) return od.lighting;
  if (detailName === 'noise') {
    if (od.noise) return od.noise;
    if (od.quiet_area === true) return 'quiet';
  }
  return null;
}

/**
 * Returns the effective detail value for a room:
 * 1. Official source value if present
 * 2. Otherwise community consensus value if present
 * 3. Otherwise null ("unknown")
 */
export function getEffectiveDetailValue(
  room: Room,
  detailName: DetailName,
  community?: RoomCommunitySummary | null
): { value: string | null; source: 'official' | 'community' | 'unknown' } {
  const officialVal = getOfficialDetailValue(room, detailName);
  if (officialVal) {
    return { value: officialVal, source: 'official' };
  }
  const commVal = community?.details[detailName]?.value ?? null;
  if (commVal) {
    return { value: commVal, source: 'community' };
  }
  return { value: null, source: 'unknown' };
}

/**
 * Resolves community consensus for room details:
 * - Ignores `hidden` reports.
 * - Counts ONLY each device_hash's latest vote per `detail_name`.
 * - Most-reported value wins; ties break in favour of the value with the most recent report.
 */
export function resolveDetailConsensus(
  reports: DetailReportRow[]
): Partial<Record<DetailName, DetailConsensusItem>> {
  const visible = reports.filter((r) => !r.hidden);
  const byDetail = new Map<DetailName, DetailReportRow[]>();

  for (const r of visible) {
    const list = byDetail.get(r.detail_name);
    if (list) {
      list.push(r);
    } else {
      byDetail.set(r.detail_name, [r]);
    }
  }

  const result: Partial<Record<DetailName, DetailConsensusItem>> = {};

  for (const [detailName, rows] of byDetail.entries()) {
    // Sort newest first (timestamp desc, then id desc)
    const sorted = [...rows].sort((a, b) => {
      const tDiff = Date.parse(b.reported_at) - Date.parse(a.reported_at);
      if (tDiff !== 0) return tDiff;
      return b.id - a.id;
    });

    // Keep only each device_hash's latest vote
    const latestByDevice = new Map<string, DetailReportRow>();
    for (const r of sorted) {
      if (!latestByDevice.has(r.device_hash)) {
        latestByDevice.set(r.device_hash, r);
      }
    }

    const totalUniqueDevices = latestByDevice.size;
    if (totalUniqueDevices === 0) continue;

    // Tally votes per detail_value, tracking the newest vote timestamp & id for tie-breaking
    const tally = new Map<
      string,
      { count: number; newestMs: number; newestId: number; newestIso: string }
    >();

    for (const vote of latestByDevice.values()) {
      const ms = Date.parse(vote.reported_at);
      const existing = tally.get(vote.detail_value);
      if (!existing) {
        tally.set(vote.detail_value, {
          count: 1,
          newestMs: ms,
          newestId: vote.id,
          newestIso: vote.reported_at,
        });
      } else {
        existing.count += 1;
        if (ms > existing.newestMs || (ms === existing.newestMs && vote.id > existing.newestId)) {
          existing.newestMs = ms;
          existing.newestId = vote.id;
          existing.newestIso = vote.reported_at;
        }
      }
    }

    let winningValue: string | null = null;
    let winningStats: {
      count: number;
      newestMs: number;
      newestId: number;
      newestIso: string;
    } | null = null;

    for (const [val, stats] of tally.entries()) {
      if (!winningStats) {
        winningValue = val;
        winningStats = stats;
        continue;
      }
      if (
        stats.count > winningStats.count ||
        (stats.count === winningStats.count &&
          (stats.newestMs > winningStats.newestMs ||
            (stats.newestMs === winningStats.newestMs && stats.newestId > winningStats.newestId)))
      ) {
        winningValue = val;
        winningStats = stats;
      }
    }

    const overallLastReportedAt = sorted[0]?.reported_at ?? null;

    result[detailName] = {
      detailName,
      value: winningValue,
      voteCount: winningStats?.count ?? 0,
      totalUniqueDevices,
      lastReportedAt: overallLastReportedAt,
    };
  }

  return result;
}

const zurichLockPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Zurich',
  weekday: 'short',
  hour: '2-digit',
  hour12: false,
});

function getZurichHourAndWeekend(iso: string): { hour: number; isWeekend: boolean } {
  const parts = zurichLockPartsFormatter.formatToParts(new Date(iso));
  let weekday = 'Mon';
  let hour = 12;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    if (p.type === 'hour') hour = Number.parseInt(p.value, 10) % 24;
  }
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  return { hour, isWeekend };
}

/**
 * Computes a room's lock trend from visible lock_reports:
 * - Below 8 reports (or without >=3 reports in >=2 buckets and a >=30pp difference),
 *   returns `hasPattern: false` so the UI shows only the plain share + sample size.
 * - Above threshold, returns the time-of-day or weekday/weekend pattern.
 */
export function computeLockTrend(reports: LockReportRow[]): LockTrendSummary {
  const visible = reports
    .filter((r) => !r.hidden)
    .sort((a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at));

  const totalReports = visible.length;
  const lockedReports = visible.filter((r) => r.is_locked).length;
  const lastReportedAt = visible[0]?.reported_at ?? null;

  if (totalReports < LOCK_TREND_MIN_TOTAL) {
    return {
      totalReports,
      lockedReports,
      hasPattern: false,
      patternType: null,
      buckets: [],
      lastReportedAt,
    };
  }

  const timeCounts: Record<'morning' | 'afternoon' | 'evening', { locked: number; total: number }> =
    {
      morning: { locked: 0, total: 0 },
      afternoon: { locked: 0, total: 0 },
      evening: { locked: 0, total: 0 },
    };

  const dayCounts: Record<'weekday' | 'weekend', { locked: number; total: number }> = {
    weekday: { locked: 0, total: 0 },
    weekend: { locked: 0, total: 0 },
  };

  for (const r of visible) {
    const { hour, isWeekend } = getZurichHourAndWeekend(r.reported_at);
    const timeKey: 'morning' | 'afternoon' | 'evening' =
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    timeCounts[timeKey].total += 1;
    if (r.is_locked) timeCounts[timeKey].locked += 1;

    const dayKey: 'weekday' | 'weekend' = isWeekend ? 'weekend' : 'weekday';
    dayCounts[dayKey].total += 1;
    if (r.is_locked) dayCounts[dayKey].locked += 1;
  }

  const buildBuckets = <K extends LockBucketKey>(
    keys: K[],
    map: Record<K, { locked: number; total: number }>
  ): LockTrendBucketSummary[] =>
    keys
      .filter((k) => map[k].total > 0)
      .map((k) => ({
        bucket: k,
        lockedCount: map[k].locked,
        totalCount: map[k].total,
        lockedRatio: map[k].locked / map[k].total,
      }));

  // 1. Check time-of-day pattern
  const timeBuckets = buildBuckets(['morning', 'afternoon', 'evening'], timeCounts);
  const eligibleTime = timeBuckets.filter((b) => b.totalCount >= LOCK_TREND_MIN_PER_BUCKET);
  if (eligibleTime.length >= 2) {
    const ratios = eligibleTime.map((b) => b.lockedRatio);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    if (spread >= LOCK_TREND_MIN_DIFF - 1e-9) {
      return {
        totalReports,
        lockedReports,
        hasPattern: true,
        patternType: 'time_of_day',
        buckets: timeBuckets,
        lastReportedAt,
      };
    }
  }

  // 2. Check weekday vs. weekend pattern
  const dayBuckets = buildBuckets(['weekday', 'weekend'], dayCounts);
  const eligibleDay = dayBuckets.filter((b) => b.totalCount >= LOCK_TREND_MIN_PER_BUCKET);
  if (eligibleDay.length >= 2) {
    const ratios = eligibleDay.map((b) => b.lockedRatio);
    const spread = Math.max(...ratios) - Math.min(...ratios);
    if (spread >= LOCK_TREND_MIN_DIFF - 1e-9) {
      return {
        totalReports,
        lockedReports,
        hasPattern: true,
        patternType: 'day_type',
        buckets: dayBuckets,
        lastReportedAt,
      };
    }
  }

  return {
    totalReports,
    lockedReports,
    hasPattern: false,
    patternType: null,
    buckets: [],
    lastReportedAt,
  };
}

export function emptyCommunitySummary(): RoomCommunitySummary {
  return {
    lockTrend: {
      totalReports: 0,
      lockedReports: 0,
      hasPattern: false,
      patternType: null,
      buckets: [],
      lastReportedAt: null,
    },
    details: {},
    photoCount: 0,
  };
}
