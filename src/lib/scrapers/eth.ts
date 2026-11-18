import { z } from 'zod';
import {
  Booking,
  Building,
  OfficialPhoto,
  Room,
  RoomOfficialDetails,
  RoomType,
} from '@/types/domain';
import { parseZurichTimestampToIso } from '@/lib/time';

export const ETH_ROOMINFO_BASE_URL = 'https://ethz.ch/bin/ethz/roominfo';

/**
 * Known ETH building coordinates and full names (for Zentrum, Hönggerberg, Oerlikon, Basel).
 * Used to populate `buildings` table and support distance sorting & map pins.
 */
export const ETH_BUILDING_METADATA: Record<
  string,
  { name: string; address: string; lat: number; lng: number }
> = {
  HG: {
    name: 'Hauptgebäude',
    address: 'Rämistrasse 101, 8092 Zürich',
    lat: 47.37642,
    lng: 8.547995,
  },
  CAB: {
    name: 'CAB (Universitätsstrasse 6)',
    address: 'Universitätsstrasse 6, 8092 Zürich',
    lat: 47.37825,
    lng: 8.54872,
  },
  CHN: {
    name: 'CHN (Universitätsstrasse 16)',
    address: 'Universitätsstrasse 16, 8092 Zürich',
    lat: 47.37927,
    lng: 8.54848,
  },
  CLA: {
    name: 'CLA (Tannenstrasse 3)',
    address: 'Tannenstrasse 3, 8092 Zürich',
    lat: 47.37821,
    lng: 8.54695,
  },
  ETF: {
    name: 'ETF (Sternwartstrasse 7)',
    address: 'Sternwartstrasse 7, 8092 Zürich',
    lat: 47.37752,
    lng: 8.55221,
  },
  ETZ: {
    name: 'ETZ (Gloriastrasse 35)',
    address: 'Gloriastrasse 35, 8092 Zürich',
    lat: 47.37743,
    lng: 8.55351,
  },
  GLC: {
    name: 'GLC (Gloriastrasse 29)',
    address: 'Gloriastrasse 29, 8092 Zürich',
    lat: 47.3781,
    lng: 8.5532,
  },
  IFW: {
    name: 'IFW (Haldeneggsteig 4)',
    address: 'Haldeneggsteig 4, 8092 Zürich',
    lat: 47.37994,
    lng: 8.54463,
  },
  LEE: {
    name: 'LEE (Leonhardstrasse 21)',
    address: 'Leonhardstrasse 21, 8092 Zürich',
    lat: 47.37747,
    lng: 8.54531,
  },
  LFW: {
    name: 'LFW (Universitätsstrasse 2)',
    address: 'Universitätsstrasse 2, 8092 Zürich',
    lat: 47.37781,
    lng: 8.54911,
  },
  LFO: {
    name: 'LFO (Schmelzbergstrasse 9)',
    address: 'Schmelzbergstrasse 9, 8092 Zürich',
    lat: 47.37814,
    lng: 8.55015,
  },
  ML: {
    name: 'Maschinenlaboratorium (ML)',
    address: 'Sonneggstrasse 3, 8092 Zürich',
    lat: 47.37792,
    lng: 8.54761,
  },
  MM: {
    name: 'Mensa Polyterrasse (MM)',
    address: 'Leonhardstrasse 34, 8092 Zürich',
    lat: 47.37615,
    lng: 8.54642,
  },
  NO: {
    name: 'Naturwissenschaften Ost (NO)',
    address: 'Sonneggstrasse 5, 8092 Zürich',
    lat: 47.37873,
    lng: 8.54745,
  },
  Rz: {
    name: 'Rechenzentrum (RZ)',
    address: 'Clausiusstrasse 59, 8092 Zürich',
    lat: 47.38028,
    lng: 8.5469,
  },
  SOE: {
    name: 'SOE (Sonneggstrasse 28)',
    address: 'Sonneggstrasse 28, 8092 Zürich',
    lat: 47.3801,
    lng: 8.5462,
  },
  WEV: {
    name: 'WEV (Weinbergstrasse 56/58)',
    address: 'Weinbergstrasse 56/58, 8092 Zürich',
    lat: 47.3818,
    lng: 8.5441,
  },
  HIL: {
    name: 'HIL (Stefano-Franscini-Platz 5)',
    address: 'Stefano-Franscini-Platz 5, 8093 Zürich',
    lat: 47.40833,
    lng: 8.50678,
  },
  HCI: {
    name: 'HCI (Vladimir-Prelog-Weg 1-5)',
    address: 'Vladimir-Prelog-Weg 1-5, 8093 Zürich',
    lat: 47.40961,
    lng: 8.50862,
  },
  HCP: {
    name: 'HCP (Leopold-Ruzicka-Weg 4)',
    address: 'Leopold-Ruzicka-Weg 4, 8093 Zürich',
    lat: 47.40915,
    lng: 8.5105,
  },
  HIT: {
    name: 'HIT (Wolfgang-Pauli-Strasse 27)',
    address: 'Wolfgang-Pauli-Strasse 27, 8093 Zürich',
    lat: 47.40688,
    lng: 8.5082,
  },
  HPH: {
    name: 'HPH (Otto-Stern-Weg 1)',
    address: 'Otto-Stern-Weg 1, 8093 Zürich',
    lat: 47.40792,
    lng: 8.50912,
  },
  HPK: {
    name: 'HPK (Otto-Stern-Weg 5)',
    address: 'Otto-Stern-Weg 5, 8093 Zürich',
    lat: 47.4075,
    lng: 8.5103,
  },
  HPT: {
    name: 'HPT (Auguste-Piccard-Hof 1)',
    address: 'Auguste-Piccard-Hof 1, 8093 Zürich',
    lat: 47.40815,
    lng: 8.5114,
  },
  HPV: {
    name: 'HPV (Otto-Stern-Weg 7)',
    address: 'Otto-Stern-Weg 7, 8093 Zürich',
    lat: 47.40712,
    lng: 8.50985,
  },
  HPZ: {
    name: 'HPZ (John-von-Neumann-Weg 9)',
    address: 'John-von-Neumann-Weg 9, 8093 Zürich',
    lat: 47.4088,
    lng: 8.508,
  },
  HWC: {
    name: 'HWC (Stefano-Franscini-Platz 1)',
    address: 'Stefano-Franscini-Platz 1, 8093 Zürich',
    lat: 47.4085,
    lng: 8.5055,
  },
  HPR: {
    name: 'HPR ( Wolfgang-Pauli-Strasse 14)',
    address: 'Wolfgang-Pauli-Strasse 14, 8093 Zürich',
    lat: 47.4079,
    lng: 8.5076,
  },
  ONA: {
    name: 'ONA (Neunbrunnenstrasse 50)',
    address: 'Neunbrunnenstrasse 50, 8050 Zürich',
    lat: 47.4139,
    lng: 8.5405,
  },
  BSS: {
    name: 'BSS (Klingelbergstrasse 48, Basel)',
    address: 'Klingelbergstrasse 48, 4056 Basel',
    lat: 47.5624,
    lng: 7.5806,
  },
};

/**
 * Strict Zod schema for an entry in ETH `/v2/rooms&lang=de`
 */
export const EthRoomRawSchema = z.object({
  id: z.string().min(1),
  building: z.string().min(1),
  floor: z.string().min(1),
  room: z.string().min(1),
  seats: z.union([z.string(), z.number(), z.null()]).optional(),
  additionalSeats: z.union([z.string(), z.number(), z.null()]).optional(),
  type: z.string().nullable().optional(),
  typecode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  infoText: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  location: z
    .object({
      area: z.string().nullable().optional(),
      areaDesc: z.string().nullable().optional(),
      region: z.string().nullable().optional(),
      regionDesc: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const EthRoomListRawSchema = z.array(EthRoomRawSchema);

/**
 * Strict Zod schema for an entry in ETH `/rooms/{roomCode}/allocations`
 * Note: `veranstalter` is intentionally omitted from the output to guarantee we never store lecturer/organizer names.
 */
export const EthAllocationRawSchema = z.object({
  veranstaltungsort: z.union([z.string(), z.number()]).optional(),
  date_from: z.string().min(10),
  date_to: z.string().min(10),
  belegungsserie: z
    .object({
      belegungsserie: z.union([z.string(), z.number()]).optional(),
      belegungstyp: z.number().nullable().optional(),
      veranstaltung: z
        .object({
          allocationTitle: z.string().nullable().optional(),
          veranstaltungstyp: z.string().nullable().optional(),
          findetStatt: z.number().nullable().optional(),
          lehrveranstaltungstyp: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});

export const EthAllocationListRawSchema = z.array(EthAllocationRawSchema);

/**
 * Strict Zod schema for single-room details in ETH `/v2/rooms/{roomCode}&lang=de`
 */
export const EthRoomDetailRawSchema = z.object({
  id: z.string().min(1),
  rectorateResponsibility: z.union([z.string(), z.number(), z.null()]).optional(),
  responsible: z
    .object({
      unit: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  tabs: z
    .array(
      z.object({
        title: z.string().nullable().optional(),
        attributes: z
          .array(
            z.object({
              name: z.string().nullable().optional(),
              label: z.string().nullable().optional(),
              value: z.string().nullable().optional(),
            })
          )
          .nullable()
          .optional(),
        attachments: z
          .object({
            images: z
              .array(
                z.object({
                  id: z.number(),
                  filename: z.string().nullable().optional(),
                  altText: z.string().nullable().optional(),
                  type: z.string().nullable().optional(),
                })
              )
              .nullable()
              .optional(),
          })
          .nullable()
          .optional(),
      })
    )
    .nullable()
    .optional(),
});

/**
 * Parses official room attributes (outlets, board, desk_type, lighting, wheelchair)
 * and official photo URLs (`https://ethz.ch/bin/ethz/roominfo?path=/v2/files/{id}`)
 * from ETH `/v2/rooms/{roomCode}&lang=de`.
 */
export function parseEthRoomDetailPayload(rawJson: unknown): Partial<RoomOfficialDetails> {
  const validated = EthRoomDetailRawSchema.parse(rawJson);
  const details: Partial<RoomOfficialDetails> = {
    official_photos_checked: true,
    official_photos: [],
  };

  if (
    validated.rectorateResponsibility !== undefined &&
    validated.rectorateResponsibility !== null &&
    String(validated.rectorateResponsibility).trim() === '0'
  ) {
    details.is_departmental_room = true;
    const unit = validated.responsible?.unit?.trim();
    if (unit) {
      details.managing_department = unit;
    }
  } else if (
    validated.rectorateResponsibility !== undefined &&
    validated.rectorateResponsibility !== null &&
    String(validated.rectorateResponsibility).trim() === '1'
  ) {
    details.is_departmental_room = false;
  }

  let hasBlackboard = false;
  let hasWhiteboard = false;
  let explicitNoBoard = false;
  const photos: OfficialPhoto[] = [];
  const seenPhotoUrls = new Set<string>();

  for (const tab of validated.tabs ?? []) {
    for (const attr of tab.attributes ?? []) {
      const code = (attr.name ?? '').trim().toUpperCase();
      const label = (attr.label ?? '').trim().toLowerCase();
      const val = (attr.value ?? '').trim().toLowerCase();

      // Outlets (Steckdosen)
      if (
        code === 'AUS.STROMVIEL' ||
        (code.startsWith('AUS.STROM') && (val.includes('viel') || val.includes('jedem')))
      ) {
        details.outlets = 'many';
      } else if (
        code === 'AUS.STROMWENIG' ||
        (code.startsWith('AUS.STROM') && val.includes('wenig'))
      ) {
        details.outlets = 'few';
      } else if (
        code === 'AUS.STROMNO' ||
        (code.startsWith('AUS.STROM') && (val.includes('keine') || val.includes('nicht')))
      ) {
        details.outlets = 'none';
      }

      // Board (Wandtafel / Whiteboard)
      if (code.startsWith('VIS.TAF.BB') || label.includes('wandtafel')) {
        if (!val.includes('nicht vorhanden') && !val.includes('keine')) {
          hasBlackboard = true;
        }
      } else if (code.startsWith('VIS.TAF.WB') || label.includes('whiteboard')) {
        if (!val.includes('nicht vorhanden') && !val.includes('keine')) {
          hasWhiteboard = true;
        }
      } else if (code === 'VIS.TAF.NO') {
        explicitNoBoard = true;
      }

      // Desk / seating type (Bestuhlung)
      if (code === 'PL.SITZ.BESTU' || label === 'bestuhlung') {
        if (val.includes('tablar') || val.includes('klapp')) {
          details.desk_type = 'foldable';
        } else if (val.includes('lose') || val.includes('flexibel') || val.includes('tisch')) {
          details.desk_type = 'large_tables';
        } else if (val.includes('fest')) {
          details.desk_type = 'fixed';
        }
      }

      // Lighting / daylight windows (Fenster)
      if (code === 'AUS.FENSTER.NO' || (label === 'fenster' && val.includes('nicht vorhanden'))) {
        details.lighting = 'artificial';
      } else if (code.startsWith('AUS.FENSTER') && !val.includes('nicht')) {
        details.lighting = 'bright_daylight';
      }

      // Wheelchair accessibility
      if (code === 'HIFR.ZUG.RST' || val.includes('rollstuhlzugänglich')) {
        details.wheelchair = true;
      } else if (code === 'HIFR.ZUG.NO') {
        details.wheelchair = false;
      }
    }

    for (const img of tab.attachments?.images ?? []) {
      if (img.type && img.type.toUpperCase() !== 'IMAGE') continue;
      const url = `${ETH_ROOMINFO_BASE_URL}?path=/v2/files/${img.id}`;
      if (!seenPhotoUrls.has(url)) {
        seenPhotoUrls.add(url);
        photos.push({
          url,
          alt: img.altText ? img.altText.trim() : null,
        });
      }
    }
  }

  if (hasBlackboard && hasWhiteboard) {
    details.board = 'both';
  } else if (hasBlackboard) {
    details.board = 'blackboard';
  } else if (hasWhiteboard) {
    details.board = 'whiteboard';
  } else if (explicitNoBoard) {
    details.board = 'none';
  }

  details.official_photos = photos;
  return details;
}

export function mapEthRoomType(rawType: string | null | undefined): RoomType {
  const normalized = (rawType ?? '').trim().toLowerCase();
  if (normalized.includes('hörsaal') || normalized.includes('lecture')) {
    return 'lecture_hall';
  }
  if (
    normalized.includes('seminar') ||
    normalized.includes('unterricht') ||
    normalized.includes('kursraum') ||
    normalized.includes('übungsraum')
  ) {
    return 'seminar_room';
  }
  if (
    normalized.includes('computer') ||
    normalized.includes('pc-') ||
    normalized.includes('arbeitsplatzraum')
  ) {
    return 'computer_room';
  }
  if (normalized.includes('lern') || normalized.includes('study')) {
    return 'study_space';
  }
  return 'other';
}

export function isStudentRelevantEthRoom(rawType: string | null | undefined): boolean {
  const normalized = (rawType ?? '').trim().toLowerCase();
  if (!normalized) return false;
  // Exclude staff meeting rooms, exhibition foyers, utility spaces
  if (
    normalized.includes('sitzungszimmer') ||
    normalized.includes('meeting') ||
    normalized.includes('foyer') ||
    normalized.includes('ausstellung') ||
    normalized.includes('gastro') ||
    normalized.includes('aussenfläche')
  ) {
    return false;
  }
  const mapped = mapEthRoomType(rawType);
  return (
    mapped === 'lecture_hall' ||
    mapped === 'seminar_room' ||
    mapped === 'computer_room' ||
    mapped === 'study_space'
  );
}

export function normalizeEthCampus(
  rawLocationName: string | null | undefined,
  area: string | null | undefined
): string {
  const loc = (rawLocationName ?? '').trim();
  if (loc.includes('Hönggerberg')) return 'Hönggerberg';
  if (loc.includes('Zentrum')) return 'Zentrum';
  if (loc.includes('Oerlikon')) return 'Oerlikon';
  if (loc.includes('Basel')) return 'Basel';
  if (area === 'H') return 'Hönggerberg';
  if (area === 'Z') return 'Zentrum';
  if (area === 'O') return 'Oerlikon';
  return loc || 'Zentrum';
}

export interface ParsedEthRoomsAndBuildings {
  buildings: Building[];
  rooms: Room[];
}

/**
 * Parses and validates raw JSON from `https://ethz.ch/bin/ethz/roominfo?path=/v2/rooms&lang=de`.
 * Throws a ZodError if the upstream schema has changed incompatibly.
 */
export function parseEthRoomsPayload(
  rawJson: unknown,
  options: { teachingRoomsOnly?: boolean } = {}
): ParsedEthRoomsAndBuildings {
  const teachingRoomsOnly = options.teachingRoomsOnly ?? true;
  const validated = EthRoomListRawSchema.parse(rawJson);

  const buildingsMap = new Map<string, Building>();
  const rooms: Room[] = [];

  for (const item of validated) {
    const rawType = item.type ?? 'Unbekannt';
    if (teachingRoomsOnly && !isStudentRelevantEthRoom(rawType)) {
      continue;
    }

    const buildingCode = item.building.trim();
    const floor = item.floor.trim();
    const roomNumber = item.room.trim();
    const displayName = `${buildingCode} ${floor} ${roomNumber}`;
    const roomId = `ETH:${displayName}`;
    const buildingId = `ETH:${buildingCode}`;
    const campus = normalizeEthCampus(
      item.locationName ?? item.location?.areaDesc ?? null,
      item.area ?? null
    );

    if (!buildingsMap.has(buildingId)) {
      const meta = ETH_BUILDING_METADATA[buildingCode];
      buildingsMap.set(buildingId, {
        id: buildingId,
        institution: 'ETH',
        campus,
        code: buildingCode,
        name: meta?.name ?? buildingCode,
        address: meta?.address ?? null,
        lat: meta?.lat ?? null,
        lng: meta?.lng ?? null,
        official_map_url: `https://ethz.ch/staffnet/de/utils/location.html?building=${encodeURIComponent(buildingCode)}`,
      });
    }

    const parsedSeats =
      item.seats !== null && item.seats !== undefined
        ? Number.parseInt(String(item.seats), 10)
        : null;
    const capacity = parsedSeats !== null && !Number.isNaN(parsedSeats) ? parsedSeats : null;

    const parsedAdditional =
      item.additionalSeats !== null && item.additionalSeats !== undefined
        ? Number.parseInt(String(item.additionalSeats), 10)
        : undefined;

    const officialUrl = `https://ethz.ch/staffnet/de/service/raeume-gebaeude/rauminfo/raumdetails.html?building=${encodeURIComponent(
      buildingCode
    )}&floor=${encodeURIComponent(floor)}&room=${encodeURIComponent(roomNumber)}`;

    rooms.push({
      id: roomId,
      building_id: buildingId,
      institution: 'ETH',
      campus,
      building_code: buildingCode,
      floor,
      room_number: roomNumber,
      display_name: displayName,
      room_type: mapEthRoomType(rawType),
      source_room_type: rawType,
      capacity,
      exam_capacity: null,
      official_details: {
        ...(parsedAdditional !== undefined && !Number.isNaN(parsedAdditional)
          ? { additional_seats: parsedAdditional }
          : {}),
      },
      official_url: officialUrl,
      live_occupancy_key: null,
      schedule_status: 'unknown',
      last_scraped_at: null,
    });
  }

  return {
    buildings: Array.from(buildingsMap.values()),
    rooms,
  };
}

/**
 * Parses and validates raw JSON from
 * `https://ethz.ch/bin/ethz/roominfo?path=/rooms/{roomCode}/allocations&from=YYYY-MM-DD&to=YYYY-MM-DD`.
 * Drops `veranstalter` (lecturer/organizer names) and cancelled events (`findetStatt === 0`).
 */
export function parseEthAllocationsPayload(
  rawJson: unknown,
  roomId: string,
  scrapedAtIso: string
): Booking[] {
  const validated = EthAllocationListRawSchema.parse(rawJson);
  const bookings: Booking[] = [];

  for (const item of validated) {
    const veranstaltung = item.belegungsserie?.veranstaltung;
    if (veranstaltung?.findetStatt === 0) {
      continue;
    }

    const startIso = parseZurichTimestampToIso(item.date_from);
    const endIso = parseZurichTimestampToIso(item.date_to);

    if (Date.parse(endIso) <= Date.parse(startIso)) {
      continue;
    }

    const title = (veranstaltung?.allocationTitle ?? '').trim() || 'Booked';
    const bookingType = (veranstaltung?.veranstaltungstyp ?? '').trim() || null;

    bookings.push({
      room_id: roomId,
      start_time: startIso,
      end_time: endIso,
      title,
      booking_type: bookingType,
      source: 'eth_rauminfo',
      scraped_at: scrapedAtIso,
    });
  }

  return bookings;
}

export function getPoliteUserAgent(): string {
  return (
    process.env.SCRAPER_USER_AGENT ||
    'FreeRoomFinder/0.1 (unofficial student project; contact: jzavagli@ethz.ch)'
  );
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchEthRoomsList(): Promise<ParsedEthRoomsAndBuildings> {
  const url = `${ETH_ROOMINFO_BASE_URL}?path=/v2/rooms&lang=de`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': getPoliteUserAgent(),
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`ETH /v2/rooms HTTP ${response.status}: ${response.statusText}`);
  }
  const rawJson: unknown = await response.json();
  return parseEthRoomsPayload(rawJson, { teachingRoomsOnly: true });
}

export async function fetchEthRoomAllocations(
  displayName: string,
  roomId: string,
  fromYYYYMMDD: string,
  toYYYYMMDD: string,
  scrapedAtIso: string = new Date().toISOString()
): Promise<Booking[]> {
  const encodedRoom = encodeURIComponent(displayName);
  const url = `${ETH_ROOMINFO_BASE_URL}?path=/rooms/${encodedRoom}/allocations&from=${encodeURIComponent(
    fromYYYYMMDD
  )}&to=${encodeURIComponent(toYYYYMMDD)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': getPoliteUserAgent(),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `ETH allocations for "${displayName}" HTTP ${response.status}: ${response.statusText}`
    );
  }

  const rawJson: unknown = await response.json();
  return parseEthAllocationsPayload(rawJson, roomId, scrapedAtIso);
}

/**
 * Fetches official room details and official photo links for a single ETH room on demand.
 * Used lazily when a user views an ETH room page whose `official_photos_checked` is not yet set.
 */
export async function fetchEthRoomOfficialDetails(
  displayName: string
): Promise<Partial<RoomOfficialDetails>> {
  const encodedRoom = encodeURIComponent(displayName);
  const url = `${ETH_ROOMINFO_BASE_URL}?path=/v2/rooms/${encodedRoom}&lang=de`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getPoliteUserAgent(),
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ETH room details for "${displayName}" HTTP ${response.status}`);
    }
    const rawJson: unknown = await response.json();
    return parseEthRoomDetailPayload(rawJson);
  } finally {
    clearTimeout(timeout);
  }
}
