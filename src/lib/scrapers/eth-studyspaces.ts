import { z } from 'zod';
import { Building, LiveOccupancyItem, Room } from '@/types/domain';
import { ETH_BUILDING_METADATA, getPoliteUserAgent } from './eth';

export const ETH_STUDYSPACES_AVAILABILITY_URL =
  'https://ethz.ch/bin/ethz/studyspaces/availability.json';
export const ETH_STUDYSPACES_PAGE_URL =
  'https://ethz.ch/students/en/campus/workspaces-for-students/occupancy-student-workspaces.html';

export const EthStudySpaceAvailabilityAttrSchema = z.object({
  roomGlobalIdentifier: z.string().min(1),
  floor: z.string().min(1),
  status: z.enum(['green', 'yellow', 'red', 'unknown']),
  occupancy: z.number().nullable().optional(),
  maxPeople: z.number().nullable().optional(),
  occupancyPercentage: z.number().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  trend: z.string().nullable().optional(),
  activeFlag: z.boolean().nullable().optional(),
});

export const EthStudySpaceAvailabilityItemSchema = z.object({
  type: z.literal('room_availability'),
  id: z.string().min(1),
  attributes: EthStudySpaceAvailabilityAttrSchema,
});

export const EthStudySpacesAvailabilityResponseSchema = z.object({
  data: z.array(EthStudySpaceAvailabilityItemSchema),
  meta: z
    .object({
      resultsTotal: z.number().optional(),
    })
    .optional(),
});

/**
 * Curated metadata from ETH's `occupancy-student-workspaces.html` page
 * (descriptive name, seats when sensor is inactive, sockets, quietness, opening hours).
 */
export const ETH_STUDY_SPACE_METADATA: Record<
  string,
  {
    title: string;
    seats?: number;
    outlets?: 'many' | 'few';
    quiet?: boolean;
    wheelchair?: boolean;
    openingHours?: string;
  }
> = {
  'BSSD65.3': {
    title: 'Lernraum BSS D-Stock',
    seats: 20,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 19:00',
  },
  BSSE12: {
    title: 'Lernraum BSS E-Stock',
    seats: 58,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 19:00',
  },
  'BSSK10.0016': {
    title: 'Aufenthaltsraum BSS K-Stock',
    seats: 58,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 19:00',
  },
  BSSK14: {
    title: 'Science Lounge BSS',
    seats: 80,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 19:00',
  },
  CABF31: {
    title: 'Lernraum CAB',
    seats: 24,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  CABH41: {
    title: 'food&lab (outside meal times)',
    seats: 200,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:00',
  },
  CHND8: {
    title: 'Grüner Boden CHN',
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  'CHNE10.0039': {
    title: 'Galerie CHN E',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  'CHNF10.0039': {
    title: 'Galerie CHN F',
    seats: 48,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  CHNF46: {
    title: 'Lernbereich CHN F 46',
    seats: 60,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  'CHNG10.0039': {
    title: 'Galerie CHN G',
    seats: 27,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  CHNH43: {
    title: 'Grüne Bibliothek',
    seats: 106,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 21:00',
  },
  'CLAD1.1': {
    title: 'Clausiusbar (outside meal times)',
    seats: 80,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  CLAD5: {
    title: 'Clausiusbar D 5',
    seats: 156,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  'ETFB8.0019': {
    title: 'Lernnische ETF B',
    seats: 18,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  'ETFD8.0019': {
    title: 'Lernnische ETF D',
    seats: 18,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  'ETZE90.2': {
    title: 'ETZ Eingangshalle 2',
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  GLCE31: {
    title: 'GLC Lichthof',
    seats: 110,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  'HCIF30.0017': {
    title: 'Lichthof HCI F',
    seats: 18,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 22:00',
  },
  HCIF5: {
    title: 'FUSION meal (outside meal times)',
    seats: 340,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 22:00',
  },
  'HCIG5.1': {
    title: 'Info-Zentrum Chemie Biologie Pharmazie',
    seats: 153,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 08:00 - 20:00',
  },
  'HCIJ30.0017': {
    title: 'Lichthof HCI J',
    seats: 18,
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 22:00',
  },
  'HCPE40.0021': {
    title: 'Korridor HCP E',
    seats: 4,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  'HCPE44.1': {
    title: 'Lernraum HCP',
    seats: 30,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:30 - 20:30',
  },
  'HGE20.0029': {
    title: 'Risalit HG E Nord',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGE30.7': {
    title: 'Catering Zone HG E',
    seats: 80,
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGE40.0029': {
    title: 'Risalit HG E Süd',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGEO27.1': {
    title: 'Galerie HG E 27',
    seats: 24,
    outlets: 'many',
    quiet: false,
    openingHours: 'Mon - Fri: 08:00 - 21:30',
  },
  'HGF20.0029': {
    title: 'Risalit HG F Nord',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGF30.0066': {
    title: 'Lichthof HG Nord',
    seats: 22,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGF30.0076': {
    title: 'Lichthof HG Süd',
    seats: 22,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGF30.1': {
    title: 'Rondell HG',
    seats: 34,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGF40.0029': {
    title: 'Risalit HG F Süd',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGG20.0029': {
    title: 'Risalit HG G Nord',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGG40.0029': {
    title: 'Risalit HG G Süd',
    seats: 24,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGH30.0059': {
    title: 'ETH-Bibliothek, Atrium Nord',
    seats: 14,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGH30.0079': {
    title: 'ETH-Bibliothek, Atrium Süd',
    seats: 14,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGH30.1': {
    title: 'ETH-Bibliothek, Lesesaal',
    seats: 150,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 08:00 - 22:00',
  },
  'HGH60.0029': {
    title: 'ETH-Bibliothek, Atrium West',
    seats: 12,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGJ60.0039': {
    title: 'Korridor HG J Nord',
    seats: 28,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  'HGJ60.0049': {
    title: 'Korridor HG J Süd',
    seats: 26,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 22:00',
  },
  HILB21: {
    title: 'Lernbereich HIL B 21',
    seats: 40,
    outlets: 'many',
    quiet: false,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  'HILE19.1': {
    title: 'Lernraum HIL E 19.1',
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  'HILE2.1': {
    title: 'Baubibliothek',
    seats: 114,
    outlets: 'many',
    quiet: false,
    openingHours: 'Mon - Fri: 08:00 - 21:00',
  },
  'HILE29.3': {
    title: 'Lernraum HIL E 29.3',
    seats: 30,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  HILE58: {
    title: 'Aufenthaltsraum HIL E Stock',
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  'HILF15.2': {
    title: 'Lernraum HIL F 15.2',
    seats: 80,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  HILG15: {
    title: 'Lernraum HIL G 15',
    seats: 185,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  'HITE12.1': {
    title: 'Physikbibliothek',
    seats: 35,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 09:00 - 19:00',
  },
  'HPHG10.0029': {
    title: 'HPH G, West',
    seats: 42,
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  'HPRD70.2': {
    title: 'food market (outside meal times)',
    seats: 380,
    outlets: 'few',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  HWCE11: {
    title: 'Lernraum HWC',
    seats: 66,
    outlets: 'many',
    quiet: true,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 22:00',
  },
  'IFWB35.1': {
    title: 'GESS-Bibliothek',
    seats: 50,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  'LFWD10.0016': {
    title: 'Lichthof LFW D',
    seats: 60,
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 06:00 - 20:30',
  },
  'MLD10.0019': {
    title: 'Lernbereich ML D (Tannenstrasse)',
    seats: 36,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  'MLH37.1': {
    title: 'Lernraum ML H 37.1',
    seats: 68,
    outlets: 'many',
    quiet: false,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
  MMB79: {
    title: 'Mensa Polyterrasse (outside meal times)',
    seats: 650,
    outlets: 'few',
    quiet: false,
    openingHours: 'Mon - Fri: 06:00 - 21:00',
  },
  MMC81: {
    title: 'Einstein & Zweistein',
    seats: 124,
    outlets: 'few',
    quiet: false,
    openingHours: 'Mon - Fri: 06:00 - 21:00',
  },
  'NOE50.0029': {
    title: 'Galerie NO E Stock',
    seats: 48,
    outlets: 'many',
    quiet: false,
    wheelchair: true,
    openingHours: 'Mon - Fri: 07:00 - 20:30',
  },
};

const KNOWN_BUILDING_PREFIXES = [
  'HCI',
  'HCP',
  'HIL',
  'HIT',
  'HPH',
  'HPR',
  'HPT',
  'HWC',
  'BSS',
  'CAB',
  'CHN',
  'CLA',
  'ETF',
  'ETZ',
  'GLC',
  'IFW',
  'LEE',
  'LFW',
  'HG',
  'ML',
  'MM',
  'NO',
];

const HOENGGERBERG_BUILDINGS = new Set([
  'HCI',
  'HCP',
  'HIL',
  'HIT',
  'HPH',
  'HPR',
  'HPT',
  'HPV',
  'HPZ',
  'HWC',
]);

/**
 * Splits a compact roomGlobalIdentifier (e.g. 'CABF31', 'HGEO27.1', 'HGH30.1')
 * using the known floor string ('F', 'EO', 'H').
 */
export function splitStudySpaceGlobalId(
  globalId: string,
  floor: string
): { buildingCode: string; floor: string; roomNumber: string; displayName: string } {
  const cleanId = globalId.trim();
  const cleanFloor = floor.trim();

  for (const prefix of KNOWN_BUILDING_PREFIXES) {
    const prefixAndFloor = `${prefix}${cleanFloor}`;
    if (cleanId.startsWith(prefixAndFloor)) {
      const roomNumber = cleanId.slice(prefixAndFloor.length).trim() || '1';
      return {
        buildingCode: prefix,
        floor: cleanFloor,
        roomNumber,
        displayName: `${prefix} ${cleanFloor} ${roomNumber}`,
      };
    }
  }

  // Fallback: split at floor occurrence
  const floorIdx = cleanId.indexOf(cleanFloor);
  if (floorIdx > 0) {
    const buildingCode = cleanId.slice(0, floorIdx);
    const roomNumber = cleanId.slice(floorIdx + cleanFloor.length) || '1';
    return {
      buildingCode,
      floor: cleanFloor,
      roomNumber,
      displayName: `${buildingCode} ${cleanFloor} ${roomNumber}`,
    };
  }

  return {
    buildingCode: cleanId.slice(0, 3),
    floor: cleanFloor,
    roomNumber: cleanId.slice(3),
    displayName: cleanId,
  };
}

/**
 * Parses `https://ethz.ch/bin/ethz/studyspaces/availability.json` into live occupancy map + room/building definitions.
 */
export function parseEthStudySpacesAvailability(rawJson: unknown): {
  occupancyItems: LiveOccupancyItem[];
  buildings: Building[];
  rooms: Room[];
} {
  const parsed = EthStudySpacesAvailabilityResponseSchema.parse(rawJson);

  const occupancyItems: LiveOccupancyItem[] = [];
  const buildingsMap = new Map<string, Building>();
  const rooms: Room[] = [];

  for (const entry of parsed.data) {
    const attr = entry.attributes;
    const key = attr.roomGlobalIdentifier;

    occupancyItems.push({
      key,
      status: attr.status,
      occupancyPercentage: attr.occupancyPercentage ?? null,
      occupiedSeats: attr.occupancy ?? null,
      maxSeats: attr.maxPeople ?? null,
      trend: attr.trend ?? null,
      timestampIso: attr.timestamp ? new Date(Date.parse(attr.timestamp)).toISOString() : null,
    });

    const { buildingCode, floor, roomNumber, displayName } = splitStudySpaceGlobalId(
      key,
      attr.floor
    );
    const buildingId = `ETH:${buildingCode}`;
    const roomId = `ETH:${displayName}`;

    const campus =
      buildingCode === 'BSS'
        ? 'Basel'
        : HOENGGERBERG_BUILDINGS.has(buildingCode)
          ? 'Hönggerberg'
          : 'Zentrum';

    if (!buildingsMap.has(buildingId)) {
      const bMeta = ETH_BUILDING_METADATA[buildingCode];
      buildingsMap.set(buildingId, {
        id: buildingId,
        institution: 'ETH',
        campus,
        code: buildingCode,
        name: bMeta?.name ?? buildingCode,
        address: bMeta?.address ?? null,
        lat: bMeta?.lat ?? null,
        lng: bMeta?.lng ?? null,
        official_map_url: `https://ethz.ch/staffnet/de/utils/location.html?building=${encodeURIComponent(
          buildingCode
        )}`,
      });
    }

    const staticMeta = ETH_STUDY_SPACE_METADATA[key];
    const capacity = attr.maxPeople ?? staticMeta?.seats ?? null;

    rooms.push({
      id: roomId,
      building_id: buildingId,
      institution: 'ETH',
      campus,
      building_code: buildingCode,
      floor,
      room_number: roomNumber,
      display_name: displayName,
      room_type: 'study_space',
      source_room_type: staticMeta?.title
        ? `Lernplatz (${staticMeta.title})`
        : 'Lernplatz / Study Space',
      capacity,
      exam_capacity: null,
      official_details: {
        ...(staticMeta?.title ? { study_area_name: staticMeta.title } : {}),
        ...(staticMeta?.outlets ? { outlets: staticMeta.outlets } : {}),
        ...(staticMeta?.quiet !== undefined ? { quiet_area: staticMeta.quiet } : {}),
        ...(staticMeta?.wheelchair !== undefined ? { wheelchair: staticMeta.wheelchair } : {}),
        ...(staticMeta?.openingHours ? { opening_hours: staticMeta.openingHours } : {}),
      },
      official_url: ETH_STUDYSPACES_PAGE_URL,
      live_occupancy_key: key,
      schedule_status: 'always_open',
      last_scraped_at: attr.timestamp
        ? new Date(Date.parse(attr.timestamp)).toISOString()
        : new Date().toISOString(),
    });
  }

  return {
    occupancyItems,
    buildings: Array.from(buildingsMap.values()),
    rooms,
  };
}

export async function fetchEthStudySpacesAvailability(): Promise<{
  occupancyItems: LiveOccupancyItem[];
  buildings: Building[];
  rooms: Room[];
}> {
  const response = await fetch(ETH_STUDYSPACES_AVAILABILITY_URL, {
    headers: {
      'User-Agent': getPoliteUserAgent(),
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // 5-minute server cache
  });

  if (!response.ok) {
    throw new Error(`ETH studyspaces availability HTTP ${response.status}: ${response.statusText}`);
  }

  const rawJson: unknown = await response.json();
  return parseEthStudySpacesAvailability(rawJson);
}
