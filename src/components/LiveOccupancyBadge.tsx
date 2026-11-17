'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { LiveOccupancyItem } from '@/types/domain';
import { useSettings } from './SettingsProvider';

interface LiveOccupancyBadgeProps {
  occupancy?: LiveOccupancyItem | null;
  liveOccupancyKey?: string | null;
}

export function LiveOccupancyBadge({ occupancy, liveOccupancyKey }: LiveOccupancyBadgeProps) {
  const { t } = useSettings();

  if (!liveOccupancyKey) return null;

  if (!occupancy || occupancy.status === 'unknown' || occupancy.occupancyPercentage === null) {
    return (
      <span
        data-testid="live-occupancy-badge"
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
      >
        <Activity className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{t.liveOccupancyNoSensor}</span>
      </span>
    );
  }

  const pct = occupancy.occupancyPercentage;
  const colorClasses =
    occupancy.status === 'green'
      ? 'bg-[var(--status-free-bg)] text-[var(--status-free-text)] border-[var(--status-free-border)]'
      : occupancy.status === 'yellow'
        ? 'bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] border-[var(--status-unknown-border)]'
        : 'bg-[var(--status-booked-bg)] text-[var(--status-booked-text)] border-[var(--status-booked-border)]';

  return (
    <span
      data-testid="live-occupancy-badge"
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${colorClasses}`}
    >
      <Activity className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>{t.liveOccupancyEstimateBadge(pct, occupancy.trend)}</span>
    </span>
  );
}
