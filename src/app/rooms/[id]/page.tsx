'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  Camera,
  Check,
  Clock,
  ExternalLink,
  Info,
  Lock,
  LockOpen,
  MapPin,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  Booking,
  Building,
  CommunityPhotoItem,
  DetailName,
  LiveOccupancyItem,
  LockTrendSummary,
  Room,
  RoomCommunitySummary,
} from '@/types/domain';
import { computeFreeGapsInWindow, mergeBusyIntervals } from '@/lib/free-rooms';
import {
  ALL_DETAIL_NAMES,
  DETAIL_ALLOWED_VALUES,
  emptyCommunitySummary,
  getOfficialDetailValue,
} from '@/lib/contributions';
import { getOrCreateDeviceToken, shrinkAndStripImageInBrowser } from '@/lib/client-device';
import { getZurichDateYYYYMMDD, getZurichHHMM, zurichLocalToUtcMs } from '@/lib/time';
import { useSettings } from '@/components/SettingsProvider';
import { SingleRoomTimelineBar } from '@/components/TimelineView';
import { LiveOccupancyBadge } from '@/components/LiveOccupancyBadge';

interface RoomDetailApiPayload {
  ok: boolean;
  zurichDateYYYYMMDD: string;
  room: Room;
  building: Building | null;
  bookings: Booking[];
  community?: RoomCommunitySummary;
  communityPhotos?: CommunityPhotoItem[];
  myVotes?: Partial<Record<DetailName, string>>;
  error?: string;
}

export default function RoomDetailPage() {
  const { t } = useSettings();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const rawId = params?.id ?? '';

  const [data, setData] = useState<RoomDetailApiPayload | null>(null);
  const [community, setCommunity] = useState<RoomCommunitySummary>(emptyCommunitySummary);
  const [communityPhotos, setCommunityPhotos] = useState<CommunityPhotoItem[]>([]);
  const [myVotes, setMyVotes] = useState<Partial<Record<DetailName, string>>>({});
  const [liveOccupancy, setLiveOccupancy] = useState<LiveOccupancyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowIso] = useState<string>(() => new Date().toISOString());

  // Contribution action state
  const [isSubmittingLock, setIsSubmittingLock] = useState(false);
  const [lockFeedback, setLockFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const [submittingDetail, setSubmittingDetail] = useState<DetailName | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!rawId) return;
    let active = true;
    setLoading(true);
    const deviceToken = getOrCreateDeviceToken();

    Promise.all([
      fetch(`/api/rooms/${encodeURIComponent(decodeURIComponent(rawId))}`, {
        headers: { 'x-device-token': deviceToken },
      }),
      fetch('/api/occupancy').catch(() => null),
    ])
      .then(async ([res, occRes]) => {
        const json = (await res.json()) as RoomDetailApiPayload;
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (active) {
          setData(json);
          setCommunity(json.community ?? emptyCommunitySummary());
          setCommunityPhotos(json.communityPhotos ?? []);
          setMyVotes(json.myVotes ?? {});
          setError(null);
          if (occRes && occRes.ok && json.room.live_occupancy_key) {
            const occJson = (await occRes.json()) as {
              ok: boolean;
              occupancyByKey?: Record<string, LiveOccupancyItem>;
            };
            const item = occJson.occupancyByKey?.[json.room.live_occupancy_key] ?? null;
            setLiveOccupancy(item);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rawId]);

  const backHref = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `/?${qs}` : '/';
  }, [searchParams]);

  const studyDayFreeGaps = useMemo(() => {
    if (!data || data.room.schedule_status === 'unknown') return [];
    const dateStr = data.zurichDateYYYYMMDD;
    const studyStartMs = zurichLocalToUtcMs(dateStr, '07:00:00');
    const studyEndMs = zurichLocalToUtcMs(dateStr, '22:00:00');

    const rawBusy = data.bookings.map((b) => ({
      startMs: Math.max(studyStartMs, Date.parse(b.start_time)),
      endMs: Math.min(studyEndMs, Date.parse(b.end_time)),
    }));
    const merged = mergeBusyIntervals(rawBusy);
    return computeFreeGapsInWindow(studyStartMs, studyEndMs, merged);
  }, [data]);

  const latestCommunityIso = useMemo(() => {
    const candidates: string[] = [];
    if (community.lockTrend.lastReportedAt) {
      candidates.push(community.lockTrend.lastReportedAt);
    }
    for (const d of Object.values(community.details)) {
      if (d?.lastReportedAt) candidates.push(d.lastReportedAt);
    }
    for (const p of communityPhotos) {
      if (p.uploaded_at) candidates.push(p.uploaded_at);
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => Date.parse(b) - Date.parse(a));
    return candidates[0] ?? null;
  }, [community, communityPhotos]);

  const handleLockReport = useCallback(
    async (isLocked: boolean) => {
      if (!data || isSubmittingLock) return;
      setIsSubmittingLock(true);
      setLockFeedback(null);

      try {
        const deviceToken = getOrCreateDeviceToken();
        const res = await fetch(`/api/rooms/${encodeURIComponent(data.room.id)}/lock-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLocked, deviceToken }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          lockTrend?: LockTrendSummary;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.lockTrend) {
          setLockFeedback({
            type: 'error',
            message: json.error || `HTTP ${res.status}`,
          });
          return;
        }
        setCommunity((prev) => ({
          ...prev,
          lockTrend: json.lockTrend!,
        }));
        setLockFeedback({
          type: 'ok',
          message: isLocked ? 'Recorded: door was locked.' : 'Recorded: door was open.',
        });
      } catch (err) {
        setLockFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsSubmittingLock(false);
      }
    },
    [data, isSubmittingLock]
  );

  const handleDetailVote = useCallback(
    async (detailName: DetailName, detailValue: string) => {
      if (!data || submittingDetail) return;
      setSubmittingDetail(detailName);
      setDetailFeedback(null);

      try {
        const deviceToken = getOrCreateDeviceToken();
        const res = await fetch(`/api/rooms/${encodeURIComponent(data.room.id)}/detail-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ detailName, detailValue, deviceToken }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          details?: RoomCommunitySummary['details'];
          myVotes?: Partial<Record<DetailName, string>>;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.details) {
          setDetailFeedback({
            type: 'error',
            message: json.error || `HTTP ${res.status}`,
          });
          return;
        }
        setCommunity((prev) => ({
          ...prev,
          details: json.details!,
        }));
        if (json.myVotes) {
          setMyVotes(json.myVotes);
        }
        setDetailFeedback({
          type: 'ok',
          message: 'Saved your vote.',
        });
      } catch (err) {
        setDetailFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setSubmittingDetail(null);
      }
    },
    [data, submittingDetail]
  );

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !data || isUploadingPhoto) return;

      setIsUploadingPhoto(true);
      setPhotoFeedback(null);

      try {
        const deviceToken = getOrCreateDeviceToken();
        const shrunkBlob = await shrinkAndStripImageInBrowser(file, 1600);
        const formData = new FormData();
        formData.append('deviceToken', deviceToken);
        formData.append('photo', shrunkBlob, 'room.jpg');

        const res = await fetch(`/api/rooms/${encodeURIComponent(data.room.id)}/photos`, {
          method: 'POST',
          body: formData,
        });
        const json = (await res.json()) as {
          ok: boolean;
          photo?: CommunityPhotoItem;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.photo) {
          setPhotoFeedback({
            type: 'error',
            message: json.error || `HTTP ${res.status}`,
          });
          return;
        }
        setCommunityPhotos((prev) => [json.photo!, ...prev]);
        setCommunity((prev) => ({
          ...prev,
          photoCount: prev.photoCount + 1,
        }));
        setPhotoFeedback({
          type: 'ok',
          message: 'Photo uploaded (all EXIF/GPS metadata removed).',
        });
      } catch (err) {
        setPhotoFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsUploadingPhoto(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [data, isUploadingPhoto]
  );

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-muted)]">
        Loading room details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-primary)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {t.roomPageBack}
        </Link>
        <div className="rounded-xl border border-[var(--status-booked-border)] bg-[var(--status-booked-bg)] text-[var(--status-booked-text)] p-4 text-sm">
          {error || 'Room not found'}
        </div>
      </div>
    );
  }

  const { room, building, bookings, zurichDateYYYYMMDD } = data;
  const officialPhotos = room.official_details.official_photos ?? [];
  const hasOfficialPhotos = officialPhotos.length > 0;
  const { lockTrend } = community;

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-primary)] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t.roomPageBack}</span>
      </Link>

      {/* Header Card */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <span>{room.institution}</span>
              <span>·</span>
              <span>{room.campus}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] mt-1">
              {room.display_name}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {building?.name ?? room.building_code}
              {building?.address ? ` · ${building.address}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {room.official_url && (
              <a
                href={room.official_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] px-3.5 py-2 text-xs font-bold hover:opacity-90 transition"
              >
                <span>
                  {room.institution === 'UZH'
                    ? room.schedule_status === 'always_open'
                      ? t.officialUzhStudyLink
                      : t.officialUzhRoomLink
                    : t.officialRoomLink}
                </span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
            {building?.official_map_url && (
              <a
                href={building.official_map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold hover:opacity-90 transition"
              >
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {room.institution === 'UZH' ? t.uzhLocationLink : t.officialLocationLink}
                </span>
              </a>
            )}
          </div>
        </div>

        {/* Key Metadata Grid */}
        {room.official_details.is_departmental_room && (
          <div
            role="note"
            data-testid="departmental-room-warning"
            className="rounded-xl border border-[var(--status-unknown-border)] bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] px-4 py-3 text-xs font-medium flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.departmentalRoomNotice(room.official_details.managing_department)}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[var(--border-color)]">
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
              {t.buildingLabel}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {room.building_code} ({t.floorLabel} {room.floor})
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <div className="text-xs text-[var(--text-muted)]">{t.typeLabel}</div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {room.source_room_type}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              {t.capacityLabel}
            </div>
            <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {t.seatsCount(room.capacity)}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {t.scheduleLastScraped}
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
              {room.last_scraped_at
                ? `${getZurichDateYYYYMMDD(room.last_scraped_at)} ${getZurichHHMM(
                    room.last_scraped_at
                  )}`
                : t.neverScraped}
            </div>
          </div>
        </div>
      </section>

      {/* Live Occupancy Card (ETH Study Spaces) */}
      {room.live_occupancy_key && (
        <section
          data-testid="room-live-occupancy-section"
          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
              {t.liveOccupancyHeading}
            </h2>
            <LiveOccupancyBadge
              liveOccupancyKey={room.live_occupancy_key}
              occupancy={liveOccupancy}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {t.liveOccupancyUpdated}
            {liveOccupancy?.timestampIso
              ? ` · ${getZurichDateYYYYMMDD(
                  liveOccupancy.timestampIso
                )} ${getZurichHHMM(liveOccupancy.timestampIso)}`
              : ''}
          </p>
        </section>
      )}

      {/* Today's Timeline & Bookings */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            {t.todayTimelineHeading} ({zurichDateYYYYMMDD})
          </h2>
        </div>

        {room.schedule_status === 'unknown' ? (
          <div className="rounded-xl border border-[var(--status-unknown-border)] bg-[var(--status-unknown-bg)] text-[var(--status-unknown-text)] p-4 text-sm font-medium">
            {t.scheduleNotFoundBadge} — {t.unknownScheduleGroupDesc}
          </div>
        ) : (
          <>
            <SingleRoomTimelineBar
              zurichDateYYYYMMDD={zurichDateYYYYMMDD}
              bookings={bookings}
              nowIso={nowIso}
              heightClass="h-12"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Free Windows Today */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t.freeGapsTodayHeading}
                </h3>
                {studyDayFreeGaps.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {studyDayFreeGaps.map((g, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg border border-[var(--status-free-border)] bg-[var(--status-free-bg)] text-[var(--status-free-text)] px-3 py-2 text-xs font-semibold flex items-center justify-between"
                      >
                        <span>
                          {getZurichHHMM(g.startIso)} – {getZurichHHMM(g.endIso)}
                        </span>
                        <span>{g.durationMinutes} min</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Official Bookings Today */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t.bookingsTodayHeading}
                </h3>
                {bookings.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">{t.noBookingsToday}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {bookings.map((b, idx) => (
                      <li
                        key={idx}
                        className="rounded-lg timeline-booked-block px-3 py-2 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="font-bold shrink-0">
                          {getZurichHHMM(b.start_time)} – {getZurichHHMM(b.end_time)}
                        </span>
                        <span className="truncate font-medium">{b.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Photos Section: Official photos if available online; otherwise Community photos + upload */}
      <section
        data-testid="room-photos-section"
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Camera className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            {t.photosSectionHeading}
          </h2>
          <span
            data-testid={hasOfficialPhotos ? 'official-photos-badge' : 'community-photos-badge'}
            className="rounded-full bg-[var(--bg-muted)] border border-[var(--border-color)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]"
          >
            {hasOfficialPhotos ? t.officialPhotosBadge : t.communityPhotosBadge}
          </span>
        </div>

        {hasOfficialPhotos ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {officialPhotos.map((photo, idx) => (
              <div
                key={photo.url}
                className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]"
              >
                {/* Official photo stays hosted on ETH's server per Section 4 ("Link, don't copy") */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.alt ?? `${room.display_name} photo ${idx + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  data-testid="official-room-photo"
                  className="w-full h-48 object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {communityPhotos.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">{t.noPhotosYet}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {communityPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`${room.display_name} community photo`}
                      loading="lazy"
                      data-testid="community-room-photo"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-muted)]/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                <span>{t.photoUploadHint}</span>
              </p>

              <div>
                <input
                  ref={fileInputRef}
                  id="room-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                  className="sr-only"
                />
                <label
                  htmlFor="room-photo-upload"
                  data-testid="upload-photo-button"
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition cursor-pointer ${
                    isUploadingPhoto
                      ? 'opacity-60 cursor-wait bg-[var(--bg-muted)] text-[var(--text-muted)] border-[var(--border-color)]'
                      : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--accent-primary)] hover:opacity-90'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isUploadingPhoto ? t.photoUploading : t.photoUploadButton}</span>
                </label>
              </div>
            </div>

            {photoFeedback && (
              <p
                role="status"
                data-testid="photo-feedback"
                className={`text-xs font-medium ${
                  photoFeedback.type === 'error'
                    ? 'text-[var(--status-booked-text)]'
                    : 'text-[var(--status-free-text)]'
                }`}
              >
                {photoFeedback.message}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Room Details: Official values shown directly; missing values open to Community Consensus */}
      <section
        data-testid="room-details-section"
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <SlidersHorizontal
              className="w-4 h-4 text-[var(--accent-primary)]"
              aria-hidden="true"
            />
            {t.detailsSectionHeading}
          </h2>
        </div>

        <div className="divide-y divide-[var(--border-color)]">
          {ALL_DETAIL_NAMES.map((detailName) => {
            const officialVal = getOfficialDetailValue(room, detailName);
            const consensusItem = community.details[detailName];
            const myVote = myVotes[detailName];
            const allowedOptions = DETAIL_ALLOWED_VALUES[detailName];

            return (
              <div
                key={detailName}
                data-testid={`detail-row-${detailName}`}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {t.detailNames[detailName]}
                    </span>
                    {officialVal !== null ? (
                      <span
                        data-testid={`detail-official-badge-${detailName}`}
                        className="rounded-full bg-[var(--status-free-bg)] border border-[var(--status-free-border)] text-[var(--status-free-text)] px-2 py-0.5 text-[11px] font-bold"
                      >
                        {t.badgeOfficial}
                      </span>
                    ) : consensusItem?.value ? (
                      <span
                        data-testid={`detail-community-badge-${detailName}`}
                        className="rounded-full bg-[var(--bg-muted)] border border-[var(--border-color)] text-[var(--text-secondary)] px-2 py-0.5 text-[11px] font-semibold"
                      >
                        {t.badgeCommunity(consensusItem.totalUniqueDevices)}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {officialVal !== null ? (
                      <span className="font-semibold text-[var(--text-primary)]">
                        {t.detailValues[officialVal] ?? officialVal}
                      </span>
                    ) : consensusItem?.value ? (
                      <span
                        data-testid={`detail-consensus-value-${detailName}`}
                        className="font-semibold text-[var(--text-primary)]"
                      >
                        {t.detailValues[consensusItem.value] ?? consensusItem.value}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">{t.detailUnknownPrompt}</span>
                    )}
                  </div>
                </div>

                {/* Only offer community voting options when no official value is provided online */}
                {officialVal === null && (
                  <div
                    role="group"
                    aria-label={t.detailNames[detailName]}
                    className="flex flex-wrap gap-1.5"
                  >
                    {allowedOptions.map((optValue) => {
                      const isMyVote = myVote === optValue;
                      return (
                        <button
                          key={optValue}
                          type="button"
                          disabled={submittingDetail !== null}
                          data-testid={`vote-${detailName}-${optValue}`}
                          onClick={() => handleDetailVote(detailName, optValue)}
                          aria-pressed={isMyVote}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition cursor-pointer ${
                            isMyVote
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                              : 'border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {isMyVote && <Check className="w-3 h-3" aria-hidden="true" />}
                          <span>{t.detailValues[optValue] ?? optValue}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {detailFeedback && (
          <p
            role="status"
            data-testid="detail-feedback"
            className={`text-xs font-medium ${
              detailFeedback.type === 'error'
                ? 'text-[var(--status-booked-text)]'
                : 'text-[var(--status-free-text)]'
            }`}
          >
            {detailFeedback.message}
          </p>
        )}
      </section>

      {/* Door Lock Reports & Lock Trend */}
      <section
        data-testid="room-lock-section"
        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            {t.lockSectionHeading}
          </h2>
          <span
            data-testid="lock-trend-summary"
            className="text-xs font-bold text-[var(--text-secondary)]"
          >
            {lockTrend.totalReports === 0
              ? t.lockNoReportsYet
              : t.lockPlainSummary(lockTrend.lockedReports, lockTrend.totalReports)}
          </span>
        </div>

        {lockTrend.hasPattern && lockTrend.buckets.length > 0 && (
          <div
            data-testid="lock-trend-pattern"
            className="rounded-xl bg-[var(--bg-muted)] p-3.5 space-y-2"
          >
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              {t.lockPatternIntro}
            </p>
            <div className="flex flex-wrap gap-2">
              {lockTrend.buckets.map((b) => (
                <span
                  key={b.bucket}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)]"
                >
                  {t.lockBucketLabels[b.bucket]}:{' '}
                  <strong>
                    {b.lockedCount}/{b.totalCount}
                  </strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={isSubmittingLock}
            data-testid="report-open-btn"
            onClick={() => handleLockReport(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--status-free-border)] bg-[var(--status-free-bg)] text-[var(--status-free-text)] px-4 py-2 text-xs font-bold hover:opacity-90 transition cursor-pointer"
          >
            <LockOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.lockReportOpenBtn}</span>
          </button>

          <button
            type="button"
            disabled={isSubmittingLock}
            data-testid="report-locked-btn"
            onClick={() => handleLockReport(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--status-booked-border)] bg-[var(--status-booked-bg)] text-[var(--status-booked-text)] px-4 py-2 text-xs font-bold hover:opacity-90 transition cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.lockReportLockedBtn}</span>
          </button>
        </div>

        {lockFeedback && (
          <p
            role="status"
            data-testid="lock-feedback"
            className={`text-xs font-medium ${
              lockFeedback.type === 'error'
                ? 'text-[var(--status-booked-text)]'
                : 'text-[var(--status-free-text)]'
            }`}
          >
            {lockFeedback.message}
          </p>
        )}
      </section>

      {/* Data Freshness Summary */}
      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-2">
        <span>
          {t.scheduleLastScraped}:{' '}
          <strong className="text-[var(--text-secondary)]">
            {room.last_scraped_at
              ? `${getZurichDateYYYYMMDD(room.last_scraped_at)} ${getZurichHHMM(
                  room.last_scraped_at
                )}`
              : t.neverScraped}
          </strong>
        </span>
        <span>
          {t.communityLastUpdated}:{' '}
          <strong className="text-[var(--text-secondary)]">
            {latestCommunityIso
              ? `${getZurichDateYYYYMMDD(latestCommunityIso)} ${getZurichHHMM(latestCommunityIso)}`
              : '—'}
          </strong>
        </span>
      </section>
    </div>
  );
}
