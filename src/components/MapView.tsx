'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import { Building2, MapPin } from 'lucide-react';
import { EvaluatedRoom, LiveOccupancyItem } from '@/types/domain';
import { useSettings } from './SettingsProvider';
import { LiveOccupancyBadge } from './LiveOccupancyBadge';

interface BuildingPinGroup {
  buildingId: string;
  institution: string;
  buildingCode: string;
  buildingName: string;
  campus: string;
  lat: number;
  lng: number;
  rooms: EvaluatedRoom[];
}

interface MapViewProps {
  evaluatedRooms: EvaluatedRoom[];
  occupancyByKey: Record<string, LiveOccupancyItem>;
  searchQueryString: string;
}

export function MapView({ evaluatedRooms, occupancyByKey, searchQueryString }: MapViewProps) {
  const { t } = useSettings();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const buildingGroups = useMemo(() => {
    const map = new Map<string, BuildingPinGroup>();
    for (const item of evaluatedRooms) {
      const b = item.building;
      const lat = b?.lat ?? null;
      const lng = b?.lng ?? null;
      if (lat === null || lng === null) continue;

      const existing = map.get(item.room.building_id);
      if (existing) {
        existing.rooms.push(item);
      } else {
        map.set(item.room.building_id, {
          buildingId: item.room.building_id,
          institution: item.room.institution,
          buildingCode: item.room.building_code,
          buildingName: b?.name ?? item.room.building_code,
          campus: item.room.campus,
          lat,
          lng,
          rooms: [item],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.buildingCode.localeCompare(b.buildingCode));
  }, [evaluatedRooms]);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    () => buildingGroups[0]?.buildingId ?? null
  );

  // Ensure selectedBuildingId stays valid if filters change
  useEffect(() => {
    if (
      buildingGroups.length > 0 &&
      (!selectedBuildingId || !buildingGroups.some((g) => g.buildingId === selectedBuildingId))
    ) {
      setSelectedBuildingId(buildingGroups[0]!.buildingId);
    }
  }, [buildingGroups, selectedBuildingId]);

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [8.547995, 47.37642], // ETH HG default center
        zoom: 14.5,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapInstanceRef.current = map;
    } catch {
      // Fallback gracefully if WebGL is unavailable in headless environments
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (map) {
        map.remove();
      }
      mapInstanceRef.current = null;
    };
  }, []);

  // Render building pins onto the MapLibre instance
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (buildingGroups.length === 0) return;

    for (const group of buildingGroups) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSelected = group.buildingId === selectedBuildingId;
      btn.setAttribute('data-testid', `map-pin-${group.buildingCode}`);
      btn.setAttribute('aria-label', `${group.buildingCode}: ${group.rooms.length} free rooms`);
      btn.className = `px-2.5 py-1 rounded-full font-bold text-xs shadow-md border-2 transition cursor-pointer flex items-center gap-1 ${
        isSelected
          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-white scale-110 z-20'
          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--accent-primary)] hover:scale-105'
      }`;
      btn.innerHTML = `<span>${group.buildingCode}</span><span class="rounded-full px-1.5 py-0.2 bg-black/15 text-[11px]">${group.rooms.length}</span>`;

      btn.addEventListener('click', () => {
        setSelectedBuildingId(group.buildingId);
        map.flyTo({
          center: [group.lng, group.lat],
          zoom: Math.max(map.getZoom(), 15.5),
          duration: 400,
        });
      });

      const marker = new maplibregl.Marker({ element: btn, anchor: 'center' })
        .setLngLat([group.lng, group.lat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [buildingGroups, selectedBuildingId]);

  // Fit bounds only when the set of matching buildings changes (not when clicking an individual pin)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || buildingGroups.length === 0) return;

    if (buildingGroups.length === 1) {
      map.flyTo({
        center: [buildingGroups[0]!.lng, buildingGroups[0]!.lat],
        zoom: 15.5,
        duration: 500,
      });
    } else {
      const bounds = new maplibregl.LngLatBounds();
      for (const group of buildingGroups) {
        bounds.extend([group.lng, group.lat]);
      }
      try {
        map.fitBounds(bounds, { padding: 55, maxZoom: 15.5, duration: 500 });
      } catch {
        // Ignore fitBounds errors before layout
      }
    }
  }, [buildingGroups]);

  const selectedGroup = useMemo(
    () => buildingGroups.find((g) => g.buildingId === selectedBuildingId) ?? null,
    [buildingGroups, selectedBuildingId]
  );

  return (
    <div className="space-y-4" data-testid="map-view">
      {/* Map Canvas Container */}
      <div className="relative rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-muted)] shadow-xs">
        <div
          ref={mapContainerRef}
          className="w-full h-72 sm:h-96"
          aria-label="Campus building map"
        />

        {/* Accessible Building Pin Selector Bar (also works with keyboard & without WebGL) */}
        <div
          role="group"
          aria-label="Building pins"
          className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 flex items-center gap-2 overflow-x-auto"
        >
          <span className="text-xs font-semibold text-[var(--text-muted)] shrink-0 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            Buildings:
          </span>
          {buildingGroups.map((group) => {
            const active = group.buildingId === selectedBuildingId;
            return (
              <button
                key={group.buildingId}
                type="button"
                data-testid={`building-pin-button-${group.buildingCode}`}
                onClick={() => {
                  setSelectedBuildingId(group.buildingId);
                  mapInstanceRef.current?.flyTo({
                    center: [group.lng, group.lat],
                    zoom: 16,
                    duration: 400,
                  });
                }}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--accent-primary)]'
                    : 'bg-[var(--bg-muted)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]'
                }`}
              >
                <span>{group.buildingCode}</span>
                <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]">
                  {group.rooms.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Building Room List */}
      {!selectedGroup ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-muted)]">
          {t.mapSelectPinPrompt}
        </div>
      ) : (
        <div
          data-testid="map-building-rooms"
          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                {t.mapBuildingRoomsHeading(
                  selectedGroup.buildingCode,
                  selectedGroup.buildingName,
                  selectedGroup.rooms.length
                )}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {selectedGroup.institution} · {selectedGroup.campus}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {selectedGroup.rooms.map((item) => {
              const roomHref = `/rooms/${encodeURIComponent(item.room.id)}${
                searchQueryString ? `?${searchQueryString}` : ''
              }`;
              const occ = item.room.live_occupancy_key
                ? occupancyByKey[item.room.live_occupancy_key]
                : null;
              return (
                <Link
                  key={item.room.id}
                  href={roomHref}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-3 hover:border-[var(--accent-primary)] transition flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-[var(--accent-primary)]">
                        {item.room.display_name}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {item.room.source_room_type} · {t.seatsCount(item.room.capacity)}
                      </div>
                    </div>
                    <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-[var(--status-free-bg)] text-[var(--status-free-text)] border border-[var(--status-free-border)] shrink-0">
                      {item.room.schedule_status === 'always_open'
                        ? t.studySpaceAlwaysOpenBadge
                        : item.freeForRestOfDay
                          ? t.freeRestOfDay
                          : item.freeUntilHHMM
                            ? t.freeUntil(item.freeUntilHHMM)
                            : t.freeRestOfDay}
                    </span>
                  </div>
                  {item.room.live_occupancy_key && (
                    <div>
                      <LiveOccupancyBadge
                        liveOccupancyKey={item.room.live_occupancy_key}
                        occupancy={occ}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
