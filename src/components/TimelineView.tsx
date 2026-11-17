'use client';

import React from 'react';
import Link from 'next/link';
import { Booking, EvaluatedRoom } from '@/types/domain';
import { getZurichHHMM, zurichLocalToUtcMs } from '@/lib/time';
import { useSettings } from './SettingsProvider';

const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

interface SingleRoomTimelineBarProps {
  zurichDateYYYYMMDD: string;
  bookings: Booking[];
  nowIso: string;
  heightClass?: string;
}

export function SingleRoomTimelineBar({
  zurichDateYYYYMMDD,
  bookings,
  nowIso,
  heightClass = 'h-9',
}: SingleRoomTimelineBarProps) {
  const { t } = useSettings();
  const rangeStartMs = zurichLocalToUtcMs(
    zurichDateYYYYMMDD,
    `${String(START_HOUR).padStart(2, '0')}:00:00`
  );
  const rangeEndMs = zurichLocalToUtcMs(
    zurichDateYYYYMMDD,
    `${String(END_HOUR).padStart(2, '0')}:00:00`
  );
  const nowMs = Date.parse(nowIso);

  const nowPercent =
    nowMs >= rangeStartMs && nowMs <= rangeEndMs
      ? ((nowMs - rangeStartMs) / (rangeEndMs - rangeStartMs)) * 100
      : null;

  return (
    <div className="w-full">
      <div className="relative flex justify-between text-[10px] font-mono text-[var(--text-muted)] mb-1 select-none">
        {HOURS.filter((_, idx) => idx % 2 === 0 || idx === HOURS.length - 1).map((hr) => (
          <span key={hr}>{String(hr).padStart(2, '0')}:00</span>
        ))}
      </div>
      <div
        className={`relative w-full ${heightClass} rounded-md timeline-free-block overflow-hidden`}
        role="img"
        aria-label={`${t.todayTimelineHeading}`}
      >
        {/* Hour grid ticks */}
        {HOURS.slice(1, -1).map((hr) => {
          const leftPct = ((hr - START_HOUR) / (END_HOUR - START_HOUR)) * 100;
          return (
            <div
              key={hr}
              style={{ left: `${leftPct}%` }}
              className="absolute top-0 bottom-0 w-px bg-[var(--border-color)]/60 pointer-events-none"
            />
          );
        })}

        {/* Booked blocks (striped pattern + label so never relies on color alone) */}
        {bookings.map((b, idx) => {
          const bStart = Math.max(rangeStartMs, Date.parse(b.start_time));
          const bEnd = Math.min(rangeEndMs, Date.parse(b.end_time));
          if (bEnd <= bStart) return null;

          const leftPct = ((bStart - rangeStartMs) / (rangeEndMs - rangeStartMs)) * 100;
          const widthPct = ((bEnd - bStart) / (rangeEndMs - rangeStartMs)) * 100;

          return (
            <div
              key={`${b.start_time}-${idx}`}
              style={{
                left: `${leftPct}%`,
                width: `${Math.max(widthPct, 1.2)}%`,
              }}
              title={`${getZurichHHMM(b.start_time)}–${getZurichHHMM(b.end_time)}: ${b.title}`}
              className="absolute top-0.5 bottom-0.5 rounded-sm timeline-booked-block px-1 flex items-center overflow-hidden text-[10px] font-semibold leading-none"
            >
              <span className="truncate">
                {getZurichHHMM(b.start_time)} {b.title}
              </span>
            </div>
          );
        })}

        {/* Vertical "Now" line */}
        {nowPercent !== null && (
          <div
            style={{ left: `${nowPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--now-line)] z-10 pointer-events-none"
            title={`${t.timelineNowLabel}: ${getZurichHHMM(nowMs)}`}
          >
            <span className="absolute -top-0.5 -left-1.5 w-3 h-1.5 rounded-full bg-[var(--now-line)]" />
          </div>
        )}
      </div>
    </div>
  );
}

interface TimelineTableProps {
  evaluatedRooms: EvaluatedRoom[];
  zurichDateYYYYMMDD: string;
  nowIso: string;
  searchQueryString: string;
}

export function TimelineView({
  evaluatedRooms,
  zurichDateYYYYMMDD,
  nowIso,
  searchQueryString,
}: TimelineTableProps) {
  const { t } = useSettings();
  const totalMinutes = TOTAL_MINUTES;
  void totalMinutes;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg px-3 py-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm timeline-free-block inline-block" />
          {t.timelineLegendFree}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-4 h-3 rounded-sm timeline-booked-block inline-block" />
          {t.timelineLegendBooked}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-0.5 h-3.5 bg-[var(--now-line)] inline-block" />
          {t.timelineNowLabel} ({getZurichHHMM(nowIso)})
        </span>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl divide-y divide-[var(--border-color)] overflow-hidden">
        {evaluatedRooms.map((item) => {
          const roomHref = `/rooms/${encodeURIComponent(item.room.id)}${
            searchQueryString ? `?${searchQueryString}` : ''
          }`;
          return (
            <div
              key={item.room.id}
              className="p-3 hover:bg-[var(--bg-muted)]/60 transition flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              <div className="sm:w-48 shrink-0 flex items-baseline justify-between sm:block">
                <Link
                  href={roomHref}
                  className="font-bold text-sm text-[var(--accent-primary)] hover:underline"
                >
                  {item.room.display_name}
                </Link>
                <div className="text-xs text-[var(--text-muted)]">
                  {item.room.institution} · {item.room.campus} · {t.seatsCount(item.room.capacity)}
                </div>
                <div className="text-xs font-medium text-[var(--status-free-text)] mt-0.5">
                  {item.freeForRestOfDay
                    ? t.freeRestOfDay
                    : item.freeUntilHHMM
                      ? t.freeUntil(item.freeUntilHHMM)
                      : ''}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <SingleRoomTimelineBar
                  zurichDateYYYYMMDD={zurichDateYYYYMMDD}
                  bookings={item.todayBookings}
                  nowIso={nowIso}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
