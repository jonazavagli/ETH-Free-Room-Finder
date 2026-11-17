import { z } from 'zod';
import { Booking, Building, Room, RoomType } from '@/types/domain';
import { parseZurichTimestampToIso } from '@/lib/time';

export const UZH_3VROOMS_PORTAL_URL =
  'https://uzh.book.3vrooms.app/default/Anonymous/Calendar/PortalFind';
export const UZH_STUDY_ROOMS_URL =
  'https://www.campuskultur.uzh.ch/en/campusnutzung-und-bewilligungen/raeume/weitere-raeume/studentische-lernraeume.html';

export const UZH_CAMPUS_FILTER_SETTINGS: Array<{
  campus: string;
  filtersettingId: number;
}> = [
  { campus: 'Zentrum', filtersettingId: 24885 },
  { campus: 'Irchel', filtersettingId: 22059 },
  { campus: 'Oerlikon', filtersettingId: 15325 },
];

/**
 * Curated UZH building metadata and coordinates across Zentrum, Irchel, and Oerlikon.
 */
export const UZH_BUILDING_METADATA: Record<
  string,
  { name: string; campus: string; address: string; lat: number; lng: number }
> = {
  KOL: {
    name: 'Kollegiengebäude (KOL)',
    campus: 'Zentrum',
    address: 'Rämistrasse 71, 8006 Zürich',
    lat: 47.37476,
    lng: 8.54822,
  },
  KO2: {
    name: 'Kollegiengebäude 2 (KO2)',
    campus: 'Zentrum',
    address: 'Rämistrasse 71, 8006 Zürich',
    lat: 47.3752,
    lng: 8.5487,
  },
  KOH: {
    name: 'Kollegiengebäude Hörsaaltrakt (KOH)',
    campus: 'Zentrum',
    address: 'Rämistrasse 71, 8006 Zürich',
    lat: 47.37495,
    lng: 8.5485,
  },
  HAH: {
    name: 'Häldeliweg 2 (HAH)',
    campus: 'Zentrum',
    address: 'Häldeliweg 2, 8044 Zürich',
    lat: 47.37595,
    lng: 8.5518,
  },
  RAA: {
    name: 'Rämistrasse 59 (RAA)',
    campus: 'Zentrum',
    address: 'Rämistrasse 59, 8001 Zürich',
    lat: 47.37282,
    lng: 8.54911,
  },
  RAI: {
    name: 'Rämistrasse 74 (RAI)',
    campus: 'Zentrum',
    address: 'Rämistrasse 74, 8001 Zürich',
    lat: 47.37338,
    lng: 8.5494,
  },
  RAK: {
    name: 'Rämistrasse 78 (RAK)',
    campus: 'Zentrum',
    address: 'Rämistrasse 78, 8001 Zürich',
    lat: 47.3738,
    lng: 8.5492,
  },
  SOC: {
    name: 'Rämistrasse 69 (SOC)',
    campus: 'Zentrum',
    address: 'Rämistrasse 69, 8001 Zürich',
    lat: 47.3741,
    lng: 8.5486,
  },
  SOD: {
    name: 'Schönberggasse 11 (SOD)',
    campus: 'Zentrum',
    address: 'Schönberggasse 11, 8001 Zürich',
    lat: 47.3736,
    lng: 8.5499,
  },
  SOE: {
    name: 'Schönberggasse 1 (SOE)',
    campus: 'Zentrum',
    address: 'Schönberggasse 1, 8001 Zürich',
    lat: 47.3732,
    lng: 8.5496,
  },
  SOF: {
    name: 'Schönberggasse 9 (SOF)',
    campus: 'Zentrum',
    address: 'Schönberggasse 9, 8001 Zürich',
    lat: 47.37345,
    lng: 8.5498,
  },
  FRE: {
    name: 'Freiestrasse 36 (FRE)',
    campus: 'Zentrum',
    address: 'Freiestrasse 36, 8032 Zürich',
    lat: 47.3698,
    lng: 8.5572,
  },
  GLT: {
    name: 'Gloriastrasse 24 (GLT)',
    campus: 'Zentrum',
    address: 'Gloriastrasse 24, 8006 Zürich',
    lat: 47.3769,
    lng: 8.5529,
  },
  KAB: {
    name: 'Kantonsschulstrasse 3 (KAB)',
    campus: 'Zentrum',
    address: 'Kantonsschulstrasse 3, 8001 Zürich',
    lat: 47.3721,
    lng: 8.5497,
  },
  KUM: {
    name: 'Künstlergasse 12 (KUM)',
    campus: 'Zentrum',
    address: 'Künstlergasse 12, 8001 Zürich',
    lat: 47.3753,
    lng: 8.5476,
  },
  PLD: {
    name: 'Plattenstrasse 14 (PLD)',
    campus: 'Zentrum',
    address: 'Plattenstrasse 14, 8032 Zürich',
    lat: 47.3738,
    lng: 8.5528,
  },
  Y03: {
    name: 'Irchel Bau 03 (Y03)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3968,
    lng: 8.5491,
  },
  Y04: {
    name: 'Irchel Bau 04 (Y04)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3971,
    lng: 8.5495,
  },
  Y10: {
    name: 'Irchel Bau 10 (Y10)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3973,
    lng: 8.5488,
  },
  Y13: {
    name: 'Irchel Bau 13 (Y13)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3975,
    lng: 8.5498,
  },
  Y14: {
    name: 'Irchel Bau 14 (Y14)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.39765,
    lng: 8.55,
  },
  Y15: {
    name: 'Irchel Bau 15 (Y15)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3978,
    lng: 8.5502,
  },
  Y16: {
    name: 'Irchel Bau 16 (Y16)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.398,
    lng: 8.5506,
  },
  Y17: {
    name: 'Irchel Bau 17 (Y17)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3982,
    lng: 8.551,
  },
  Y21: {
    name: 'Irchel Bau 21 (Y21)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3965,
    lng: 8.5505,
  },
  Y22: {
    name: 'Irchel Bau 22 (Y22)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3967,
    lng: 8.5509,
  },
  Y23: {
    name: 'Irchel Bau 23 (Y23)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3969,
    lng: 8.5512,
  },
  Y24: {
    name: 'Irchel Bau 24 / Lichthof (Y24)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3972,
    lng: 8.5515,
  },
  Y27: {
    name: 'Irchel Bau 27 (Y27)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3976,
    lng: 8.5518,
  },
  Y35: {
    name: 'Irchel Bau 35 (Y35)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3984,
    lng: 8.5522,
  },
  Y36: {
    name: 'Irchel Bau 36 (Y36)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3986,
    lng: 8.5526,
  },
  Y44: {
    name: 'Irchel Bau 44 (Y44)',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.399,
    lng: 8.5531,
  },
  Y: {
    name: 'Campus Irchel',
    campus: 'Irchel',
    address: 'Winterthurerstrasse 190, 8057 Zürich',
    lat: 47.3974,
    lng: 8.5508,
  },
  AFL: {
    name: 'Affolternstrasse 56 (AFL)',
    campus: 'Oerlikon',
    address: 'Affolternstrasse 56, 8050 Zürich',
    lat: 47.4131,
    lng: 8.5382,
  },
  BIN: {
    name: 'Binzmühlestrasse 14 (BIN)',
    campus: 'Oerlikon',
    address: 'Binzmühlestrasse 14, 8050 Zürich',
    lat: 47.4135,
    lng: 8.5471,
  },
  AND: {
    name: 'Andreasstrasse 15 (AND)',
    campus: 'Oerlikon',
    address: 'Andreasstrasse 15, 8050 Zürich',
    lat: 47.4142,
    lng: 8.5458,
  },
};

export const Uzh3vroomsBlockSchema = z.object({
  Id: z.number(),
  RessourceId: z.number(),
  RessourceTyp: z.string(),
  Titel: z.string().nullable().optional(),
  Kommentar: z.string().nullable().optional(),
  BeginnEffective: z.string(),
  EndeEffective: z.string(),
  BlockTimesOnlyPortalIntegration: z.boolean().optional(),
});

export const Uzh3vroomsResourceSchema = z.object({
  Id: z.number(),
  Title: z.string().min(1),
  RessourcetypId: z.string().optional(),
  BlockList: z.array(Uzh3vroomsBlockSchema).default([]),
});

export const Uzh3vroomsCalendarSchema = z.object({
  RessourceList: z.array(Uzh3vroomsResourceSchema),
});

export const UzhStudyRoomsPayloadSchema = z.object({
  sourceUrl: z.string().url(),
  campuses: z.array(
    z.object({
      campus: z.string().min(1),
      rooms: z.array(
        z.object({
          name: z.string().min(1),
          building: z.string().min(1),
          floor: z.string().optional(),
          room: z.string().optional(),
        })
      ),
    })
  ),
});

export interface ParsedUzhRoomTitle {
  displayName: string;
  buildingCode: string;
  floor: string;
  roomNumber: string;
  capacity: number | null;
  roomType: RoomType;
  sourceRoomType: string;
  isExcludedSurface: boolean;
}

/**
 * Parses a UZH 3vrooms resource Title string such as:
 * - "HAH-E-03 (442 Plätze)"
 * - "KOL-G-201 Aula (280 / mit Emporen 359 Plätze ) **"
 * - "RAA-E-30 EV Workshopraum/Spezialraum (48 Plätze)"
 * - "KAB-G-01 Apérofläche (90 Plätze)" (excluded surface)
 */
export function parseUzh3vroomsTitle(rawTitle: string): ParsedUzhRoomTitle {
  const cleaned = rawTitle.replace(/\*+/g, '').trim();
  const lower = cleaned.toLowerCase();

  const isExcludedSurface =
    lower.includes('apérofläche') ||
    lower.includes('aperofläche') ||
    lower.includes('plakataushang') ||
    lower.includes('parkplatz') ||
    lower.includes('foyer') ||
    lower.includes('lichthof') ||
    lower.startsWith('mensa');

  // Extract seat count e.g. "(442 Plätze)" or "(280 / mit Emporen 359 Plätze )" or "(80 Stehplätze/ 60 Sitzplätze)"
  let capacity: number | null = null;
  const sitzMatch = /(\d+)\s*Sitzplätz/i.exec(cleaned);
  const plaetzeMatch = /\((\d+)\s*(?:\/[^)]*)?Plätz/i.exec(cleaned);
  if (sitzMatch && sitzMatch[1]) {
    capacity = Number.parseInt(sitzMatch[1], 10);
  } else if (plaetzeMatch && plaetzeMatch[1]) {
    capacity = Number.parseInt(plaetzeMatch[1], 10);
  }

  // Extract code prefix before first space or parenthesis, e.g. "HAH-E-03" or "SOD-1-102" or "BIN-1.D.22"
  const codeToken = (cleaned.split(/\s+|\(/)[0] ?? cleaned).trim();
  const parts = codeToken.split('-');
  const buildingCode = (parts[0] ?? 'UZH').trim();
  const floor = (parts[1] ?? 'E').trim();
  const roomNumber = parts.slice(2).join('-').trim() || '1';
  const displayName = parts.length >= 3 ? `${buildingCode}-${floor}-${roomNumber}` : codeToken;

  let roomType: RoomType = 'seminar_room';
  let sourceRoomType = 'Seminarraum (UZH)';

  if (lower.includes('studienplätze') || lower.includes('lern')) {
    roomType = 'study_space';
    sourceRoomType = 'Lernplatz (UZH)';
  } else if (
    lower.includes('aula') ||
    lower.includes('hörsaal') ||
    (capacity !== null && capacity >= 90)
  ) {
    roomType = 'lecture_hall';
    sourceRoomType = 'Hörsaal (UZH)';
  }

  return {
    displayName,
    buildingCode,
    floor,
    roomNumber,
    capacity,
    roomType,
    sourceRoomType,
    isExcludedSurface,
  };
}

/**
 * Converts a 3vrooms wall-clock timestamp (which 3vrooms suffixes with 'Z' even though
 * the hours/minutes are local Europe/Zurich time!) into a canonical UTC ISO 8601 string.
 */
export function parseUzh3vroomsWallTimeToIso(rawWallIsoWithZ: string): string {
  const withoutZ = rawWallIsoWithZ.trim().replace(/Z$/i, '');
  return parseZurichTimestampToIso(withoutZ);
}

/**
 * Parses a UZH 3vrooms `/default/api/v1.0/calendar` response into buildings, rooms, and bookings.
 */
export function parseUzh3vroomsCalendarPayload(
  rawJson: unknown,
  defaultCampus: string,
  scrapedAtIso: string
): {
  buildings: Building[];
  rooms: Room[];
  bookingsByRoomId: Map<string, Booking[]>;
} {
  const validated = Uzh3vroomsCalendarSchema.parse(rawJson);

  const buildingsMap = new Map<string, Building>();
  const roomsMap = new Map<string, Room>();
  const bookingsByRoomId = new Map<string, Booking[]>();

  for (const resource of validated.RessourceList) {
    const parsedTitle = parseUzh3vroomsTitle(resource.Title);
    if (parsedTitle.isExcludedSurface) {
      continue;
    }

    const { displayName, buildingCode, floor, roomNumber, capacity, roomType, sourceRoomType } =
      parsedTitle;

    const buildingMeta = UZH_BUILDING_METADATA[buildingCode];
    const campus = buildingMeta?.campus ?? defaultCampus;
    const buildingId = `UZH:${buildingCode}`;
    const roomId = `UZH:${displayName}`;

    if (!buildingsMap.has(buildingId)) {
      buildingsMap.set(buildingId, {
        id: buildingId,
        institution: 'UZH',
        campus,
        code: buildingCode,
        name: buildingMeta?.name ?? `UZH ${buildingCode}`,
        address: buildingMeta?.address ?? null,
        lat: buildingMeta?.lat ?? null,
        lng: buildingMeta?.lng ?? null,
        official_map_url: 'https://www.plaene.uzh.ch/',
      });
    }

    if (!roomsMap.has(roomId)) {
      roomsMap.set(roomId, {
        id: roomId,
        building_id: buildingId,
        institution: 'UZH',
        campus,
        building_code: buildingCode,
        floor,
        room_number: roomNumber,
        display_name: displayName,
        room_type: roomType,
        source_room_type: sourceRoomType,
        capacity,
        exam_capacity: null,
        official_details: {},
        official_url: UZH_3VROOMS_PORTAL_URL,
        live_occupancy_key: null,
        schedule_status: 'ok',
        last_scraped_at: scrapedAtIso,
      });
    }

    const roomBookings: Booking[] = bookingsByRoomId.get(roomId) ?? [];

    for (const block of resource.BlockList) {
      // Only RessourceTyp === "1" represents an actual room booking ("belegt").
      // "O" is outside opening hours (00:00-07:00 / 22:00-00:00) and "S" is a portal booking policy note.
      if (block.RessourceTyp !== '1' || block.BlockTimesOnlyPortalIntegration) {
        continue;
      }

      const startIso = parseUzh3vroomsWallTimeToIso(block.BeginnEffective);
      const endIso = parseUzh3vroomsWallTimeToIso(block.EndeEffective);

      if (Date.parse(endIso) <= Date.parse(startIso)) {
        continue;
      }

      roomBookings.push({
        room_id: roomId,
        start_time: startIso,
        end_time: endIso,
        title: (block.Titel ?? '').trim() || 'belegt',
        booking_type: 'UZH Belegung',
        source: 'uzh_3vrooms',
        scraped_at: scrapedAtIso,
      });
    }

    bookingsByRoomId.set(roomId, roomBookings);
  }

  return {
    buildings: Array.from(buildingsMap.values()),
    rooms: Array.from(roomsMap.values()),
    bookingsByRoomId,
  };
}

/**
 * Parses static UZH student study areas from `fixtures/uzh-study-rooms.json`.
 */
export function parseUzhStudyRoomsPayload(rawJson: unknown): {
  buildings: Building[];
  rooms: Room[];
} {
  const validated = UzhStudyRoomsPayloadSchema.parse(rawJson);

  const buildingsMap = new Map<string, Building>();
  const rooms: Room[] = [];
  const nowIso = new Date().toISOString();

  for (const campusGroup of validated.campuses) {
    for (const item of campusGroup.rooms) {
      const buildingCode = item.building.trim();
      const bMeta = UZH_BUILDING_METADATA[buildingCode];
      const campus = bMeta?.campus ?? campusGroup.campus;
      const buildingId = `UZH:${buildingCode}`;

      if (!buildingsMap.has(buildingId)) {
        buildingsMap.set(buildingId, {
          id: buildingId,
          institution: 'UZH',
          campus,
          code: buildingCode,
          name: bMeta?.name ?? `UZH ${buildingCode}`,
          address: bMeta?.address ?? null,
          lat: bMeta?.lat ?? null,
          lng: bMeta?.lng ?? null,
          official_map_url: 'https://www.plaene.uzh.ch/',
        });
      }

      const displayName = item.name.trim();
      const roomId = `UZH:${displayName}`;

      rooms.push({
        id: roomId,
        building_id: buildingId,
        institution: 'UZH',
        campus,
        building_code: buildingCode,
        floor: item.floor ?? 'E',
        room_number: item.room ?? displayName,
        display_name: displayName,
        room_type: 'study_space',
        source_room_type: 'Lernraum (UZH)',
        capacity: null,
        exam_capacity: null,
        official_details: {
          study_area_name: displayName,
        },
        official_url: validated.sourceUrl || UZH_STUDY_ROOMS_URL,
        live_occupancy_key: null,
        schedule_status: 'always_open',
        last_scraped_at: nowIso,
      });
    }
  }

  return {
    buildings: Array.from(buildingsMap.values()),
    rooms,
  };
}
