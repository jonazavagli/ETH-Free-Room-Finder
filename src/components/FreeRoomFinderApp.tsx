'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  Clock,
  List,
  Lock,
  Map as MapIcon,
  Plug,
  Search,
  Users,
  WifiOff,
} from 'lucide-react';
import {
  Booking,
  Building,
  FreeRoomsSearchResult,
  LiveOccupancyItem,
  Room,
  RoomCommunitySummary,
  RoomType,
} from '@/types/domain';
import { evaluateFreeRooms } from '@/lib/free-rooms';
import { getZurichHHMM } from '@/lib/time';
import { useSettings } from './SettingsProvider';
import { TimelineView } from './TimelineView';
import { MapView } from './MapView';
import { LiveOccupancyBadge } from './LiveOccupancyBadge';

const ALL_ROOM_TYPES: RoomType[] = [
  'lecture_hall',
  'seminar_room',
  'study_space',
  'computer_room',
  'other',
];

const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

const STORAGE_FILTERS_KEY = 'frf_last_filters_v1';
const STORAGE_CACHE_KEY = 'frf_cached_data_v1';

interface FilterState {
  mode: 'now' | 'window';
  windowStartHHMM: string;
  windowEndHHMM: string;
  minDurationMinutes: number;
  institution: 'ALL' | 'ETH' | 'UZH';
  campus: string; // 'ALL' or campus name
  buildingCodes: string[];
  roomTypes: RoomType[];
  minCapacity: number;
  includeUnknownCapacity: boolean;
  requireOutlets: boolean;
  requireBoard: boolean;
  requireQuiet: boolean;
  includeUnknownFeatures: boolean;
  view: 'list' | 'timeline' | 'map';
  simulateStale: boolean;
}

const DEFAULT_FILTERS: FilterState = {
  mode: 'now',
  windowStartHHMM: '10:00',
  windowEndHHMM: '16:00',
  minDurationMinutes: 120, // First-visit default: free from now for 2 hours
  institution: 'ALL',
  campus: 'ALL',
  buildingCodes: [],
  roomTypes: ['lecture_hall', 'seminar_room', 'study_space', 'computer_room'],
  minCapacity: 0,
  includeUnknownCapacity: true,
  requireOutlets: false,
  requireBoard: false,
  requireQuiet: false,
  includeUnknownFeatures: true,
  view: 'list',
  simulateStale: false,
};

interface ApiRoomsPayload {
  ok: boolean;
  zurichDateYYYYMMDD: string;
  evaluatedAtIso: string;
  buildings: Building[];
  rooms: Room[];
  bookings: Booking[];
  communitySummariesByRoomId?: Record<string, RoomCommunitySummary>;
  cachedAtIso?: string;
}

export function FreeRoomFinderApp() {
  const { t } = useSettings();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [buildingSearchText, setBuildingSearchText] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const [payload, setPayload] = useState<ApiRoomsPayload | null>(null);
  const [occupancyByKey, setOccupancyByKey] = useState<Record<string, LiveOccupancyItem>>({});
  const [searchTimestampIso, setSearchTimestampIso] = useState<string>(() =>
    new Date().toISOString()
  );

  // Restore filters from URL or localStorage once on mount
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    const hasUrlParams = Array.from(searchParams.keys()).length > 0;
    if (hasUrlParams) {
      const modeParam = searchParams.get('mode');
      const durParam = searchParams.get('dur');
      const instParam = searchParams.get('inst');
      const campusParam = searchParams.get('campus');
      const bldParam = searchParams.get('buildings');
      const typesParam = searchParams.get('types');
      const capParam = searchParams.get('cap');
      const unkCapParam = searchParams.get('unkCap');
      const outletsParam = searchParams.get('outlets');
      const boardParam = searchParams.get('board');
      const quietParam = searchParams.get('quiet');
      const unkFeatParam = searchParams.get('unkFeat');
      const viewParam = searchParams.get('view');
      const staleParam = searchParams.get('simulateStale');
      const wStart = searchParams.get('from');
      const wEnd = searchParams.get('to');

      const restored: FilterState = {
        mode: modeParam === 'window' ? 'window' : 'now',
        windowStartHHMM: wStart || '10:00',
        windowEndHHMM: wEnd || '16:00',
        minDurationMinutes: durParam ? Number.parseInt(durParam, 10) || 120 : 120,
        institution: instParam === 'ETH' || instParam === 'UZH' ? instParam : 'ALL',
        campus: campusParam || 'ALL',
        buildingCodes: bldParam
          ? bldParam
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        roomTypes: typesParam
          ? (typesParam
              .split(',')
              .filter((x): x is RoomType => ALL_ROOM_TYPES.includes(x as RoomType)) as RoomType[])
          : DEFAULT_FILTERS.roomTypes,
        minCapacity: capParam ? Number.parseInt(capParam, 10) || 0 : 0,
        includeUnknownCapacity: unkCapParam !== '0',
        requireOutlets: outletsParam === '1',
        requireBoard: boardParam === '1',
        requireQuiet: quietParam === '1',
        includeUnknownFeatures: unkFeatParam !== '0',
        view: viewParam === 'timeline' ? 'timeline' : viewParam === 'map' ? 'map' : 'list',
        simulateStale: staleParam === '1',
      };
      setFilters(restored);
      if (searchParams.get('searched') === '1') {
        setHasSearched(true);
      }
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_FILTERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FilterState>;
        setFilters((prev) => ({
          ...prev,
          ...parsed,
          simulateStale: false,
        }));
      }
    } catch {
      // Ignore storage errors
    }
  }, [searchParams]);

  // Fetch room & booking catalog from /api/rooms and live occupancy from /api/occupancy
  const fetchRoomsData = useCallback(async (simulateStale: boolean) => {
    try {
      const [res, occRes] = await Promise.all([
        fetch(`/api/rooms${simulateStale ? '?simulateStale=1' : ''}`),
        fetch('/api/occupancy').catch(() => null),
      ]);
      if (occRes && occRes.ok) {
        const occJson = (await occRes.json()) as {
          ok: boolean;
          occupancyByKey?: Record<string, LiveOccupancyItem>;
        };
        if (occJson.ok && occJson.occupancyByKey) {
          setOccupancyByKey(occJson.occupancyByKey);
        }
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiRoomsPayload;
      if (data.ok) {
        const withCacheTime: ApiRoomsPayload = {
          ...data,
          cachedAtIso: new Date().toISOString(),
        };
        setPayload(withCacheTime);
        setIsOfflineCache(false);
        try {
          localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(withCacheTime));
        } catch {
          // Ignore quota errors
        }
      }
    } catch {
      // Offline fallback: read last saved payload from localStorage
      try {
        const raw = localStorage.getItem(STORAGE_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as ApiRoomsPayload;
          setPayload(cached);
          setIsOfflineCache(true);
        }
      } catch {
        // Ignore
      }
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomsData(filters.simulateStale);
  }, [fetchRoomsData, filters.simulateStale]);

  // Sync filters to URL and localStorage when searching or changing filters after search
  const syncFiltersToUrlAndStorage = useCallback((nextFilters: FilterState, searched: boolean) => {
    try {
      localStorage.setItem(STORAGE_FILTERS_KEY, JSON.stringify(nextFilters));
    } catch {
      // Ignore
    }

    const params = new URLSearchParams();
    params.set('mode', nextFilters.mode);
    if (nextFilters.mode === 'window') {
      params.set('from', nextFilters.windowStartHHMM);
      params.set('to', nextFilters.windowEndHHMM);
    }
    params.set('dur', String(nextFilters.minDurationMinutes));
    if (nextFilters.institution !== 'ALL') {
      params.set('inst', nextFilters.institution);
    }
    if (nextFilters.campus !== 'ALL') {
      params.set('campus', nextFilters.campus);
    }
    if (nextFilters.buildingCodes.length > 0) {
      params.set('buildings', nextFilters.buildingCodes.join(','));
    }
    if (nextFilters.roomTypes.length > 0) {
      params.set('types', nextFilters.roomTypes.join(','));
    }
    if (nextFilters.minCapacity > 0) {
      params.set('cap', String(nextFilters.minCapacity));
    }
    if (!nextFilters.includeUnknownCapacity) {
      params.set('unkCap', '0');
    }
    if (nextFilters.requireOutlets) {
      params.set('outlets', '1');
    }
    if (nextFilters.requireBoard) {
      params.set('board', '1');
    }
    if (nextFilters.requireQuiet) {
      params.set('quiet', '1');
    }
    if (!nextFilters.includeUnknownFeatures) {
      params.set('unkFeat', '0');
    }
    params.set('view', nextFilters.view);
    if (nextFilters.simulateStale) {
      params.set('simulateStale', '1');
    }
    if (searched) {
      params.set('searched', '1');
    }

    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : '/');
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchTimestampIso(new Date().toISOString());
    await fetchRoomsData(filters.simulateStale);
    setHasSearched(true);
    setIsSearching(false);
    syncFiltersToUrlAndStorage(filters, true);
  };

  const updateFilters = (patch: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (hasSearched) {
        syncFiltersToUrlAndStorage(next, true);
      }
      return next;
    });
  };

  // Derive available campuses and buildings from loaded rooms/buildings
  const availableCampuses = useMemo(() => {
    if (!payload) return ['Zentrum', 'Hönggerberg', 'Irchel', 'Oerlikon'];
    const set = new Set<string>();
    for (const b of payload.buildings) {
      if (filters.institution !== 'ALL' && b.institution !== filters.institution) {
        continue;
      }
      if (b.campus) set.add(b.campus);
    }
    return Array.from(set).sort();
  }, [payload, filters.institution]);

  const buildingsForCampus = useMemo(() => {
    if (!payload) return [];
    return payload.buildings.filter((b) => {
      if (filters.institution !== 'ALL' && b.institution !== filters.institution) {
        return false;
      }
      return filters.campus === 'ALL' ? true : b.campus === filters.campus;
    });
  }, [payload, filters.institution, filters.campus]);

  const filteredBuildingsList = useMemo(() => {
    const q = buildingSearchText.trim().toLowerCase();
    if (!q) return buildingsForCampus;
    return buildingsForCampus.filter(
      (b) =>
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        b.campus.toLowerCase().includes(q)
    );
  }, [buildingsForCampus, buildingSearchText]);

  const toggleBuildingCode = (code: string) => {
    const exists = filters.buildingCodes.includes(code);
    const nextCodes = exists
      ? filters.buildingCodes.filter((c) => c !== code)
      : [...filters.buildingCodes, code];
    updateFilters({ buildingCodes: nextCodes });
  };

  const selectAllBuildingsOnCampus = () => {
    const allCodes = buildingsForCampus.map((b) => b.code);
    updateFilters({ buildingCodes: allCodes });
  };

  const toggleRoomType = (rt: RoomType) => {
    const exists = filters.roomTypes.includes(rt);
    const nextTypes = exists
      ? filters.roomTypes.filter((x) => x !== rt)
      : [...filters.roomTypes, rt];
    updateFilters({ roomTypes: nextTypes });
  };

  // Compute search results using pure evaluateFreeRooms()
  const searchResult: FreeRoomsSearchResult | null = useMemo(() => {
    if (!hasSearched || !payload) return null;

    const buildingsMap = new Map<string, Building>();
    for (const b of payload.buildings) {
      buildingsMap.set(b.id, b);
    }

    return evaluateFreeRooms(
      payload.rooms,
      payload.bookings,
      {
        mode: filters.mode,
        nowIso: searchTimestampIso,
        windowStartHHMM: filters.windowStartHHMM,
        windowEndHHMM: filters.windowEndHHMM,
        minDurationMinutes: filters.minDurationMinutes,
        institutions: filters.institution === 'ALL' ? undefined : [filters.institution],
        campuses: filters.campus === 'ALL' ? undefined : [filters.campus],
        buildingCodes: filters.buildingCodes.length > 0 ? filters.buildingCodes : undefined,
        roomTypes: filters.roomTypes.length > 0 ? filters.roomTypes : undefined,
        minCapacity: filters.minCapacity > 0 ? filters.minCapacity : undefined,
        includeUnknownCapacity: filters.includeUnknownCapacity,
        requireOutlets: filters.requireOutlets || undefined,
        requireBoard: filters.requireBoard || undefined,
        requireQuiet: filters.requireQuiet || undefined,
        includeUnknownFeatures: filters.includeUnknownFeatures,
      },
      buildingsMap,
      payload.communitySummariesByRoomId
    );
  }, [hasSearched, payload, filters, searchTimestampIso]);

  const roomTypeLabels: Record<RoomType, string> = {
    lecture_hall: t.roomTypeLectureHall,
    seminar_room: t.roomTypeSeminarRoom,
    study_space: t.roomTypeStudySpace,
    computer_room: t.roomTypeComputerRoom,
    other: t.roomTypeOther,
  };

  const staleHoursAgo = useMemo(() => {
    if (!searchResult?.oldestScrapeIso) return 48;
    const diffMs =
      Date.parse(searchResult.evaluatedAtIso) - Date.parse(searchResult.oldestScrapeIso);
    return Math.max(36, Math.round(diffMs / 3600_000));
  }, [searchResult]);

  const currentQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('mode', filters.mode);
    if (filters.mode === 'window') {
      params.set('from', filters.windowStartHHMM);
      params.set('to', filters.windowEndHHMM);
    }
    params.set('dur', String(filters.minDurationMinutes));
    if (filters.institution !== 'ALL') {
      params.set('inst', filters.institution);
    }
    if (filters.campus !== 'ALL') {
      params.set('campus', filters.campus);
    }
    if (filters.buildingCodes.length > 0) {
      params.set('buildings', filters.buildingCodes.join(','));
    }
    if (filters.roomTypes.length > 0) {
      params.set('types', filters.roomTypes.join(','));
    }
    if (filters.minCapacity > 0) {
      params.set('cap', String(filters.minCapacity));
    }
    if (!filters.includeUnknownCapacity) {
      params.set('unkCap', '0');
    }
    if (filters.requireOutlets) {
      params.set('outlets', '1');
    }
    if (filters.requireBoard) {
      params.set('board', '1');
    }
    if (filters.requireQuiet) {
      params.set('quiet', '1');
    }
    if (!filters.includeUnknownFeatures) {
      params.set('unkFeat', '0');
    }
    params.set('view', filters.view);
    if (filters.simulateStale) {
      params.set('simulateStale', '1');
    }
    if (hasSearched) {
      params.set('searched', '1');
    }
    return params.toString();
  }, [filters, hasSearched]);
  void isLoadingCatalog;

  return (
    <div className="space-y-6">
      {/* Honest Free Definition Notice */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
        <Clock
          className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p>{t.honestFreeNotice}</p>
      </div>

      {/* Offline Banner */}
      {isOfflineCache && payload?.cachedAtIso && (
        <div
          role="status"
          className="rounded-xl border border-[var(--status-unknown-border)] bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] px-4 py-3 text-xs font-medium flex items-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {t.offlineCachedBanner(
              `${payload.zurichDateYYYYMMDD} ${getZurichHHMM(payload.cachedAtIso)}`
            )}
          </span>
        </div>
      )}

      {/* Filter Form */}
      <form
        onSubmit={handleSearchSubmit}
        aria-label={t.filterHeading}
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-xs space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            {t.filterHeading}
          </h1>
          <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.simulateStale}
              onChange={(e) => updateFilters({ simulateStale: e.target.checked })}
              className="rounded border-[var(--border-color)]"
            />
            <span>{t.simulateStaleToggle}</span>
          </label>
        </div>

        {/* 1. Time Section */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
            {t.timeHeading}
          </legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => updateFilters({ mode: 'now' })}
              aria-pressed={filters.mode === 'now'}
              className={`px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold transition flex items-center justify-between ${
                filters.mode === 'now'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] hover:opacity-90'
              }`}
            >
              <span>{t.freeFromNow}</span>
              {filters.mode === 'now' && <Check className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => updateFilters({ mode: 'window' })}
              aria-pressed={filters.mode === 'window'}
              className={`px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold transition flex items-center justify-between ${
                filters.mode === 'window'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] hover:opacity-90'
              }`}
            >
              <span>{t.customWindowToday}</span>
              {filters.mode === 'window' && <Check className="w-4 h-4" />}
            </button>
          </div>

          {filters.mode === 'window' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label
                  htmlFor="window-start"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  {t.windowStart}
                </label>
                <input
                  id="window-start"
                  type="time"
                  value={filters.windowStartHHMM}
                  onChange={(e) => updateFilters({ windowStartHHMM: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label
                  htmlFor="window-end"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  {t.windowEnd}
                </label>
                <input
                  id="window-end"
                  type="time"
                  value={filters.windowEndHHMM}
                  onChange={(e) => updateFilters({ windowEndHHMM: e.target.value })}
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
            </div>
          )}

          <div>
            <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t.minDuration}
            </span>
            <div role="group" aria-label={t.minDuration} className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map((mins) => {
                const active = filters.minDurationMinutes === mins;
                const label =
                  mins >= 60 && mins % 60 === 0
                    ? `${mins / 60} ${t.hoursUnit}`
                    : `${mins} ${t.minutesUnit}`;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => updateFilters({ minDurationMinutes: mins })}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        {/* 2. Place Section (University, Campus & Multi-select searchable buildings) */}
        <fieldset className="space-y-3 border-t border-[var(--border-color)] pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            {t.placeHeading}
          </legend>

          <div>
            <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t.institutionLabel}
            </span>
            <div role="group" aria-label={t.institutionLabel} className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: 'ALL', label: t.allInstitutions },
                  { value: 'ETH', label: 'ETH' },
                  { value: 'UZH', label: 'UZH' },
                ] as const
              ).map((opt) => {
                const active = filters.institution === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`institution-filter-${opt.value}`}
                    onClick={() => {
                      let nextCampus = filters.campus;
                      if (opt.value !== 'ALL' && nextCampus !== 'ALL' && payload) {
                        const hasCampus = payload.buildings.some(
                          (b) => b.institution === opt.value && b.campus === nextCampus
                        );
                        if (!hasCampus) {
                          nextCampus = 'ALL';
                        }
                      }
                      updateFilters({
                        institution: opt.value,
                        campus: nextCampus,
                        buildingCodes: [],
                      });
                    }}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t.campusLabel}
            </span>
            <div role="group" aria-label={t.campusLabel} className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => updateFilters({ campus: 'ALL', buildingCodes: [] })}
                aria-pressed={filters.campus === 'ALL'}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  filters.campus === 'ALL'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                }`}
              >
                {t.allCampuses}
              </button>
              {availableCampuses.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => updateFilters({ campus: c, buildingCodes: [] })}
                  aria-pressed={filters.campus === c}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    filters.campus === c
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Searchable Multi-Select Buildings */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="building-search"
                className="text-xs font-medium text-[var(--text-secondary)]"
              >
                {t.buildingsLabel}{' '}
                {filters.buildingCodes.length > 0 && `(${filters.buildingCodes.length})`}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllBuildingsOnCampus}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
                >
                  {t.selectAllOnCampus}
                </button>
                {filters.buildingCodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ buildingCodes: [] })}
                    className="text-xs text-[var(--text-muted)] hover:underline"
                  >
                    {t.clearBuildings}
                  </button>
                )}
              </div>
            </div>

            <input
              id="building-search"
              type="search"
              value={buildingSearchText}
              onChange={(e) => setBuildingSearchText(e.target.value)}
              placeholder={t.searchBuildingsPlaceholder}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
            />

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
              {filteredBuildingsList.map((b) => {
                const selected = filters.buildingCodes.includes(b.code);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBuildingCode(b.code)}
                    aria-pressed={selected}
                    title={`${b.institution} · ${b.code} — ${b.name} (${b.campus})`}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                      selected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {b.code}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        {/* 3. Room Types & Capacity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {t.roomTypeHeading}
            </legend>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_ROOM_TYPES.map((rt) => {
                const active = filters.roomTypes.includes(rt);
                return (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => toggleRoomType(rt)}
                    aria-pressed={active}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {roomTypeLabels[rt]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {t.capacityHeading}
            </legend>
            <div className="flex items-center gap-3 pt-1">
              <label htmlFor="min-seats" className="text-xs text-[var(--text-secondary)] shrink-0">
                {t.minSeatsLabel}:
              </label>
              <input
                id="min-seats"
                type="number"
                min={0}
                step={10}
                value={filters.minCapacity || ''}
                placeholder="0"
                onChange={(e) =>
                  updateFilters({
                    minCapacity: Math.max(0, Number.parseInt(e.target.value || '0', 10)),
                  })
                }
                className="w-24 rounded-lg border border-[var(--border-color)] bg-[var(--bg-page)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.includeUnknownCapacity}
                onChange={(e) => updateFilters({ includeUnknownCapacity: e.target.checked })}
                className="rounded border-[var(--border-color)]"
              />
              <span>{t.includeUnknownCapacity}</span>
            </label>
          </fieldset>
        </div>

        {/* 4. Features (Official + Community Details) */}
        <fieldset className="space-y-2 border-t border-[var(--border-color)] pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Plug className="w-3.5 h-3.5" aria-hidden="true" />
            {t.featuresHeading}
          </legend>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(
              [
                {
                  key: 'requireOutlets',
                  active: filters.requireOutlets,
                  label: t.filterRequireOutlets,
                },
                {
                  key: 'requireBoard',
                  active: filters.requireBoard,
                  label: t.filterRequireBoard,
                },
                {
                  key: 'requireQuiet',
                  active: filters.requireQuiet,
                  label: t.filterRequireQuiet,
                },
              ] as const
            ).map((feat) => (
              <button
                key={feat.key}
                type="button"
                data-testid={`feature-filter-${feat.key}`}
                onClick={() => updateFilters({ [feat.key]: !feat.active })}
                aria-pressed={feat.active}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  feat.active
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)]'
                }`}
              >
                {feat.label}
              </button>
            ))}
          </div>
          {(filters.requireOutlets || filters.requireBoard || filters.requireQuiet) && (
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={filters.includeUnknownFeatures}
                onChange={(e) => updateFilters({ includeUnknownFeatures: e.target.checked })}
                className="rounded border-[var(--border-color)]"
              />
              <span>{t.includeUnknownFeatures}</span>
            </label>
          )}
        </fieldset>

        {/* Search Submit Button */}
        <button
          type="submit"
          disabled={isSearching}
          className="w-full rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-contrast)] font-bold py-3 px-4 text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
          <span>{isSearching ? t.searching : t.searchButton}</span>
        </button>
      </form>

      {/* Results Area */}
      {!hasSearched ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-8 text-center text-sm text-[var(--text-muted)]">
          {t.tapSearchPrompt}
        </div>
      ) : (
        searchResult && (
          <section aria-label={t.resultsHeading} className="space-y-4">
            {/* Stale Data Warning Banner (> 36 hours) */}
            {searchResult.hasStaleData && (
              <div
                role="alert"
                data-testid="stale-data-warning"
                className="rounded-xl border-2 border-[var(--status-unknown-border)] bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] p-4 flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs sm:text-sm">
                  <p className="font-bold">{t.staleDataWarningTitle}</p>
                  <p className="mt-0.5">{t.staleDataWarningBody(staleHoursAgo)}</p>
                </div>
              </div>
            )}

            {/* Results Header & View Switcher (List / Timeline) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                  {t.matchingRoomsCount(searchResult.matchingRooms.length)}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {searchResult.zurichDateYYYYMMDD} · Europe/Zurich (
                  {getZurichHHMM(searchResult.evaluatedAtIso)})
                </p>
              </div>

              <div
                role="group"
                aria-label="View mode"
                className="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1 text-xs font-semibold"
              >
                <button
                  type="button"
                  onClick={() => updateFilters({ view: 'list' })}
                  aria-pressed={filters.view === 'list'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filters.view === 'list'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" aria-hidden="true" />
                  {t.viewList}
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ view: 'timeline' })}
                  aria-pressed={filters.view === 'timeline'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filters.view === 'timeline'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                  {t.viewTimeline}
                </button>
                <button
                  type="button"
                  onClick={() => updateFilters({ view: 'map' })}
                  aria-pressed={filters.view === 'map'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filters.view === 'map'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  {t.viewMap}
                </button>
              </div>
            </div>

            {/* Matching Free Rooms: List, Timeline, or Map */}
            {searchResult.matchingRooms.length === 0 ? (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-muted)]">
                {t.noMatchingRooms}
              </div>
            ) : filters.view === 'list' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {searchResult.matchingRooms.map((item) => {
                  const roomHref = `/rooms/${encodeURIComponent(item.room.id)}${
                    currentQueryString ? `?${currentQueryString}` : ''
                  }`;
                  const occ = item.room.live_occupancy_key
                    ? occupancyByKey[item.room.live_occupancy_key]
                    : null;
                  return (
                    <Link
                      key={item.room.id}
                      href={roomHref}
                      data-testid="room-card"
                      className="block rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--accent-primary)] transition shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[var(--bg-muted)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                              {item.room.institution}
                            </span>
                            <h3 className="text-base font-bold text-[var(--accent-primary)]">
                              {item.room.display_name}
                            </h3>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {item.building?.name ?? item.room.building_code} · {item.room.campus}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold bg-[var(--status-free-bg)] text-[var(--status-free-text)] border border-[var(--status-free-border)] shrink-0">
                          {item.room.schedule_status === 'always_open'
                            ? t.studySpaceAlwaysOpenBadge
                            : item.freeForRestOfDay
                              ? t.freeRestOfDay
                              : item.freeUntilHHMM
                                ? t.freeUntil(item.freeUntilHHMM)
                                : t.freeRestOfDay}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="rounded bg-[var(--bg-muted)] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                          {item.room.source_room_type}
                        </span>
                        <span>{t.seatsCount(item.room.capacity)}</span>
                        {item.room.live_occupancy_key && (
                          <LiveOccupancyBadge
                            liveOccupancyKey={item.room.live_occupancy_key}
                            occupancy={occ}
                          />
                        )}
                        {(payload?.communitySummariesByRoomId?.[item.room.id]?.lockTrend
                          .totalReports ?? 0) > 0 && (
                          <span
                            data-testid="room-card-lock-hint"
                            className="inline-flex items-center gap-1 rounded bg-[var(--bg-muted)] px-2 py-0.5 font-medium text-[var(--text-secondary)]"
                          >
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            {t.lockCardHint(
                              payload!.communitySummariesByRoomId![item.room.id]!.lockTrend
                                .lockedReports,
                              payload!.communitySummariesByRoomId![item.room.id]!.lockTrend
                                .totalReports
                            )}
                          </span>
                        )}
                        {filters.mode === 'window' && item.matchingGaps.length > 0 && (
                          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                            Gaps:{' '}
                            {item.matchingGaps
                              .map((g) => `${getZurichHHMM(g.startIso)}–${getZurichHHMM(g.endIso)}`)
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : filters.view === 'timeline' ? (
              <TimelineView
                evaluatedRooms={searchResult.matchingRooms}
                zurichDateYYYYMMDD={searchResult.zurichDateYYYYMMDD}
                nowIso={searchResult.evaluatedAtIso}
                searchQueryString={currentQueryString}
              />
            ) : (
              <MapView
                evaluatedRooms={searchResult.matchingRooms}
                occupancyByKey={occupancyByKey}
                searchQueryString={currentQueryString}
              />
            )}

            {/* Unknown Schedule Rooms Group (Never shown as free, never hidden) */}
            {searchResult.unknownScheduleRooms.length > 0 && (
              <div
                data-testid="unknown-schedule-group"
                className="mt-8 rounded-2xl border border-[var(--status-unknown-border)]/60 bg-[var(--bg-surface)] p-4 sm:p-5 space-y-3"
              >
                <div>
                  <h3 className="text-sm font-bold text-[var(--status-unknown-text)]">
                    {t.unknownScheduleGroupHeading(searchResult.unknownScheduleRooms.length)}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {t.unknownScheduleGroupDesc}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {searchResult.unknownScheduleRooms.map((item) => {
                    const roomHref = `/rooms/${encodeURIComponent(
                      item.room.id
                    )}${currentQueryString ? `?${currentQueryString}` : ''}`;
                    return (
                      <Link
                        key={item.room.id}
                        href={roomHref}
                        className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]/60 p-3 hover:border-[var(--accent-primary)] transition flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-sm font-bold text-[var(--text-primary)]">
                            {item.room.display_name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {item.room.institution} · {item.room.campus} ·{' '}
                            {t.seatsCount(item.room.capacity)}
                          </div>
                        </div>
                        <span className="rounded px-2 py-0.5 text-[11px] font-semibold bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] border border-[var(--status-unknown-border)]">
                          {t.scheduleNotFoundBadge}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )
      )}
    </div>
  );
}
