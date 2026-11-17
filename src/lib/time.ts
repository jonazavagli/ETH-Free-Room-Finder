export const ZURICH_TZ = 'Europe/Zurich';

const zurichPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZURICH_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export interface ZurichWallTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getZurichParts(dateOrIso: Date | string | number): ZurichWallTimeParts {
  const d = typeof dateOrIso === 'object' ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date passed to getZurichParts: ${String(dateOrIso)}`);
  }
  const parts = zurichPartsFormatter.formatToParts(d);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = Number.parseInt(p.value, 10);
    }
  }
  return {
    year: map.year ?? 1970,
    month: map.month ?? 1,
    day: map.day ?? 1,
    hour: map.hour ?? 0,
    minute: map.minute ?? 0,
    second: map.second ?? 0,
  };
}

export function getZurichDateYYYYMMDD(dateOrIso: Date | string | number): string {
  const { year, month, day } = getZurichParts(dateOrIso);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getZurichHHMM(dateOrIso: Date | string | number): string {
  const { hour, minute } = getZurichParts(dateOrIso);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Computes the UTC offset in milliseconds (Zurich wall time as UTC minus actual UTC)
 * at a given UTC epoch millisecond timestamp.
 * CET (+01:00) -> +3_600_000 ms
 * CEST (+02:00) -> +7_200_000 ms
 */
export function getZurichOffsetMsAtUtc(utcMs: number): number {
  const parts = getZurichParts(utcMs);
  const wallAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  // Truncate sub-second milliseconds for exact second comparison
  const truncatedUtc = Math.floor(utcMs / 1000) * 1000;
  return wallAsUtc - truncatedUtc;
}

/**
 * Converts a Europe/Zurich calendar date ('YYYY-MM-DD') and wall-clock time ('HH:MM' or 'HH:MM:SS')
 * into exact UTC epoch milliseconds. Supports '24:00' or '24:00:00' for end-of-day midnight.
 * Accurately handles both CET and CEST and the two daylight-saving transition days.
 */
export function zurichLocalToUtcMs(yyyyMmDd: string, hhMmSs: string): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!dateMatch) {
    throw new Error(`Invalid YYYY-MM-DD date: "${yyyyMmDd}"`);
  }
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hhMmSs.trim());
  if (!timeMatch) {
    throw new Error(`Invalid HH:MM(:SS) time: "${hhMmSs}"`);
  }

  const year = Number.parseInt(dateMatch[1] ?? '0', 10);
  const month = Number.parseInt(dateMatch[2] ?? '0', 10);
  const day = Number.parseInt(dateMatch[3] ?? '0', 10);
  const hour = Number.parseInt(timeMatch[1] ?? '0', 10);
  const minute = Number.parseInt(timeMatch[2] ?? '0', 10);
  const second = Number.parseInt(timeMatch[3] ?? '0', 10);

  const targetWallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  // Two-pass refinement handles DST transitions accurately
  const offset1 = getZurichOffsetMsAtUtc(targetWallAsUtc - 3600_000);
  const guess1 = targetWallAsUtc - offset1;
  const offset2 = getZurichOffsetMsAtUtc(guess1);
  return targetWallAsUtc - offset2;
}

export function zurichLocalToIso(yyyyMmDd: string, hhMmSs: string): string {
  const utcMs = zurichLocalToUtcMs(yyyyMmDd, hhMmSs);
  return new Date(utcMs).toISOString();
}

/**
 * Converts an ETH Rauminfo local timestamp string (e.g. '2026-11-16T10:00:00')
 * or an ISO string with offset into a canonical UTC ISO 8601 string.
 */
export function parseZurichTimestampToIso(rawTimestamp: string): string {
  const trimmed = rawTimestamp.trim();
  // If it already includes 'Z' or an explicit +/-HH:MM offset, Date.parse handles it directly
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
    const ms = Date.parse(trimmed);
    if (Number.isNaN(ms)) {
      throw new Error(`Invalid timestamp: "${rawTimestamp}"`);
    }
    return new Date(ms).toISOString();
  }

  // Otherwise interpret 'YYYY-MM-DDTHH:MM(:SS)' in Europe/Zurich
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(trimmed);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid local timestamp format: "${rawTimestamp}"`);
  }
  return zurichLocalToIso(match[1], match[2]);
}

export interface ZurichDayBounds {
  dateYYYYMMDD: string;
  dayStartMs: number; // 00:00 Europe/Zurich
  dayEndMs: number; // 24:00 Europe/Zurich (next day 00:00)
  dayStartIso: string;
  dayEndIso: string;
}

export function getZurichDayBounds(dateOrIso: Date | string | number): ZurichDayBounds {
  const dateYYYYMMDD =
    typeof dateOrIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrIso.trim())
      ? dateOrIso.trim()
      : getZurichDateYYYYMMDD(dateOrIso);

  const dayStartMs = zurichLocalToUtcMs(dateYYYYMMDD, '00:00:00');
  const dayEndMs = zurichLocalToUtcMs(dateYYYYMMDD, '24:00:00');

  return {
    dateYYYYMMDD,
    dayStartMs,
    dayEndMs,
    dayStartIso: new Date(dayStartMs).toISOString(),
    dayEndIso: new Date(dayEndMs).toISOString(),
  };
}

export function addDaysYYYYMMDD(yyyyMmDd: string, daysToAdd: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) {
    throw new Error(`Invalid YYYY-MM-DD: "${yyyyMmDd}"`);
  }
  const d = new Date(
    Date.UTC(
      Number.parseInt(match[1] ?? '0', 10),
      Number.parseInt(match[2] ?? '0', 10) - 1,
      Number.parseInt(match[3] ?? '0', 10) + daysToAdd,
      12,
      0,
      0
    )
  );
  return d.toISOString().slice(0, 10);
}
