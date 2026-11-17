export type Language = 'en' | 'de';

export interface Translations {
  appName: string;
  unofficialBadge: string;
  honestFreeNotice: string;
  filterHeading: string;
  timeHeading: string;
  freeFromNow: string;
  customWindowToday: string;
  windowStart: string;
  windowEnd: string;
  minDuration: string;
  hoursUnit: string;
  minutesUnit: string;
  placeHeading: string;
  institutionLabel: string;
  allInstitutions: string;
  campusLabel: string;
  allCampuses: string;
  buildingsLabel: string;
  searchBuildingsPlaceholder: string;
  selectAllOnCampus: string;
  clearBuildings: string;
  roomTypeHeading: string;
  roomTypeLectureHall: string;
  roomTypeSeminarRoom: string;
  roomTypeStudySpace: string;
  roomTypeComputerRoom: string;
  roomTypeOther: string;
  capacityHeading: string;
  minSeatsLabel: string;
  includeUnknownCapacity: string;
  searchButton: string;
  searching: string;
  resultsHeading: string;
  matchingRoomsCount: (count: number) => string;
  viewList: string;
  viewTimeline: string;
  viewMap: string;
  freeUntil: (hhmm: string) => string;
  freeRestOfDay: string;
  studySpaceAlwaysOpenBadge: string;
  liveOccupancyEstimateBadge: (pct: number, trend: string | null) => string;
  liveOccupancyNoSensor: string;
  liveOccupancyHeading: string;
  liveOccupancyUpdated: string;
  mapSelectPinPrompt: string;
  mapBuildingRoomsHeading: (code: string, name: string, count: number) => string;
  seatsCount: (count: number | null) => string;
  unknownSeats: string;
  unknownScheduleGroupHeading: (count: number) => string;
  unknownScheduleGroupDesc: string;
  scheduleNotFoundBadge: string;
  staleDataWarningTitle: string;
  staleDataWarningBody: (hoursAgo: number) => string;
  simulateStaleToggle: string;
  offlineCachedBanner: (ageText: string) => string;
  noMatchingRooms: string;
  tapSearchPrompt: string;
  timelineNowLabel: string;
  timelineLegendFree: string;
  timelineLegendBooked: string;
  timelineLegendUnknown: string;
  roomPageBack: string;
  officialRoomLink: string;
  officialUzhRoomLink: string;
  officialUzhStudyLink: string;
  officialLocationLink: string;
  uzhLocationLink: string;
  buildingLabel: string;
  floorLabel: string;
  typeLabel: string;
  capacityLabel: string;
  todayTimelineHeading: string;
  bookingsTodayHeading: string;
  noBookingsToday: string;
  freeGapsTodayHeading: string;
  officialDetailsHeading: string;
  lastUpdatedHeading: string;
  scheduleLastScraped: string;
  neverScraped: string;
  featuresHeading: string;
  filterRequireOutlets: string;
  filterRequireBoard: string;
  filterRequireQuiet: string;
  includeUnknownFeatures: string;
  lockSectionHeading: string;
  lockReportOpenBtn: string;
  lockReportLockedBtn: string;
  lockNoReportsYet: string;
  lockPlainSummary: (locked: number, total: number) => string;
  lockPatternIntro: string;
  lockCardHint: (locked: number, total: number) => string;
  lockBucketLabels: {
    morning: string;
    afternoon: string;
    evening: string;
    weekday: string;
    weekend: string;
  };
  detailsSectionHeading: string;
  badgeOfficial: string;
  badgeCommunity: (votes: number) => string;
  detailUnknownPrompt: string;
  detailNames: {
    outlets: string;
    board: string;
    desk_type: string;
    lighting: string;
    noise: string;
  };
  detailValues: Record<string, string>;
  photosSectionHeading: string;
  officialPhotosBadge: string;
  communityPhotosBadge: string;
  noPhotosYet: string;
  photoUploadHint: string;
  photoUploadButton: string;
  photoUploading: string;
  communityLastUpdated: string;
  themeLight: string;
  themeDark: string;
  themeRetro: string;
  themePastel: string;
  themeTram: string;
  languageToggleLabel: string;
  themeToggleLabel: string;
  skipToContent: string;
  aboutNavLabel: string;
  aboutHeading: string;
  aboutUnofficialTitle: string;
  aboutUnofficialBody: string;
  aboutDefinitionsTitle: string;
  aboutDefinitionsFree: string;
  aboutDefinitionsOccupancy: string;
  aboutPrivacyTitle: string;
  aboutPrivacyBody: string;
  aboutSourcesTitle: string;
  aboutCreditsBody: string;
  aboutContactTitle: string;
  aboutContactBody: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    appName: 'Free Room Finder',
    unofficialBadge: 'Unofficial student tool · Not affiliated with ETH or UZH',
    honestFreeNotice:
      '"Free" means no booking in the official schedule overlaps your time. It does not guarantee the door is unlocked or the room is empty.',
    filterHeading: 'Find a free room today',
    timeHeading: 'Time (Today in Zurich)',
    freeFromNow: 'Free from now',
    customWindowToday: 'Custom window today',
    windowStart: 'From',
    windowEnd: 'Until',
    minDuration: 'Minimum free duration',
    hoursUnit: 'h',
    minutesUnit: 'min',
    placeHeading: 'Place',
    institutionLabel: 'University',
    allInstitutions: 'Both (ETH & UZH)',
    campusLabel: 'Campus',
    allCampuses: 'All campuses',
    buildingsLabel: 'Buildings',
    searchBuildingsPlaceholder: 'Filter buildings (e.g. HG, CAB, KOL, Y15)...',
    selectAllOnCampus: 'All buildings on this campus',
    clearBuildings: 'Clear selection',
    roomTypeHeading: 'Room types',
    roomTypeLectureHall: 'Lecture halls',
    roomTypeSeminarRoom: 'Seminar rooms',
    roomTypeStudySpace: 'Study spaces',
    roomTypeComputerRoom: 'Computer rooms',
    roomTypeOther: 'Other rooms',
    capacityHeading: 'Capacity',
    minSeatsLabel: 'Minimum seats',
    includeUnknownCapacity: 'Include rooms with unknown seat count',
    searchButton: 'Search free rooms',
    searching: 'Checking schedules...',
    resultsHeading: 'Results for today',
    matchingRoomsCount: (count) =>
      count === 1 ? '1 free room matches' : `${count} free rooms match`,
    viewList: 'List',
    viewTimeline: 'Timeline',
    viewMap: 'Map',
    freeUntil: (hhmm) => `Free until ${hhmm}`,
    freeRestOfDay: 'Free for the rest of the day',
    studySpaceAlwaysOpenBadge: 'Study space (unbooked)',
    liveOccupancyEstimateBadge: (pct, trend) => {
      const trendLabel =
        trend === 'filling'
          ? ' · Filling'
          : trend === 'emptying'
            ? ' · Emptying'
            : trend === 'steady'
              ? ' · Steady'
              : '';
      return `~${pct}% occupied (est.)${trendLabel}`;
    },
    liveOccupancyNoSensor: 'Open study space (no live sensor)',
    liveOccupancyHeading: 'Live occupancy estimate (ETH study space)',
    liveOccupancyUpdated: 'Refreshed every 5 min in 20% steps (estimate)',
    mapSelectPinPrompt: 'Tap a building pin on the map to list its matching free rooms.',
    mapBuildingRoomsHeading: (code, name, count) => `${code} — ${name} (${count} matching)`,
    seatsCount: (count) => (count !== null ? `${count} seats` : 'Seats unknown'),
    unknownSeats: 'Seats unknown',
    unknownScheduleGroupHeading: (count) => `Schedule not found (${count})`,
    unknownScheduleGroupDesc:
      'These rooms match your building and type filters, but their schedule has not been fetched yet. They are never shown as free.',
    scheduleNotFoundBadge: 'Schedule not found',
    staleDataWarningTitle: 'Schedule data is older than 36 hours',
    staleDataWarningBody: (hoursAgo) =>
      `Some room schedules were last updated ${hoursAgo} hours ago. Bookings may have changed since then.`,
    simulateStaleToggle: 'Simulate stale data (>36h)',
    offlineCachedBanner: (ageText) =>
      `Offline mode: showing your last cached results from ${ageText}.`,
    noMatchingRooms: 'No rooms match your time and filter criteria right now.',
    tapSearchPrompt: 'Choose your filters above and tap "Search free rooms".',
    timelineNowLabel: 'Now',
    timelineLegendFree: 'Free',
    timelineLegendBooked: 'Booked (striped)',
    timelineLegendUnknown: 'Schedule not found',
    roomPageBack: 'Back to search results',
    officialRoomLink: 'Official ETH Rauminfo page',
    officialUzhRoomLink: 'Official UZH occupancy calendar',
    officialUzhStudyLink: 'Official UZH study rooms page',
    officialLocationLink: 'Building map & orientation',
    uzhLocationLink: 'UZH campus map',
    buildingLabel: 'Building',
    floorLabel: 'Floor',
    typeLabel: 'Type',
    capacityLabel: 'Capacity',
    todayTimelineHeading: "Today's schedule (07:00 – 22:00)",
    bookingsTodayHeading: 'Official bookings today',
    noBookingsToday: 'No official bookings scheduled for today.',
    freeGapsTodayHeading: 'Free windows today',
    officialDetailsHeading: 'Room details (Official)',
    lastUpdatedHeading: 'Data freshness',
    scheduleLastScraped: 'Schedule last fetched',
    neverScraped: 'Not fetched yet',
    featuresHeading: 'Features (Official & Community)',
    filterRequireOutlets: 'Power outlets',
    filterRequireBoard: 'Board',
    filterRequireQuiet: 'Quiet space',
    includeUnknownFeatures: 'Include rooms with unknown features',
    lockSectionHeading: 'Door lock status (Community)',
    lockReportOpenBtn: 'It was open',
    lockReportLockedBtn: 'It was locked',
    lockNoReportsYet: 'No lock reports yet',
    lockPlainSummary: (locked, total) =>
      `Locked in ${locked} of ${total} ${total === 1 ? 'report' : 'reports'}`,
    lockPatternIntro: 'Observed pattern by time:',
    lockCardHint: (locked, total) => `Locked ${locked}/${total}`,
    lockBucketLabels: {
      morning: 'Morning (07–12)',
      afternoon: 'Afternoon (12–17)',
      evening: 'Evening (17–22)',
      weekday: 'Weekdays',
      weekend: 'Weekends',
    },
    detailsSectionHeading: 'Room details',
    badgeOfficial: 'Official',
    badgeCommunity: (votes) => `Community (${votes} ${votes === 1 ? 'vote' : 'votes'})`,
    detailUnknownPrompt: 'Not listed online — add info:',
    detailNames: {
      outlets: 'Power outlets',
      board: 'Board',
      desk_type: 'Desks & seating',
      lighting: 'Lighting / windows',
      noise: 'Typical noise',
    },
    detailValues: {
      many: 'Many outlets',
      few: 'Few outlets',
      none: 'None',
      blackboard: 'Blackboard',
      whiteboard: 'Whiteboard',
      both: 'Blackboard & whiteboard',
      fixed: 'Fixed lecture rows',
      large_tables: 'Flat tables',
      foldable: 'Fold-out tablets',
      bright_daylight: 'Daylight windows',
      artificial: 'Windowless / artificial',
      dim: 'Dim lighting',
      quiet: 'Quiet',
      moderate: 'Moderate',
      lively: 'Lively',
    },
    photosSectionHeading: 'What this room looks like',
    officialPhotosBadge: 'Official room photos',
    communityPhotosBadge: 'Community photos',
    noPhotosYet: 'No photos yet for this room.',
    photoUploadHint: 'Hint: Photograph the room and desks — please avoid photographing people.',
    photoUploadButton: 'Add a room photo',
    photoUploading: 'Removing metadata & uploading...',
    communityLastUpdated: 'Last community report',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeRetro: 'Retro terminal',
    themePastel: 'Pastel',
    themeTram: 'Zürich tram',
    languageToggleLabel: 'Language',
    themeToggleLabel: 'Theme',
    skipToContent: 'Skip to main content',
    aboutNavLabel: 'About',
    aboutHeading: 'About Free Room Finder',
    aboutUnofficialTitle: 'Unofficial student project',
    aboutUnofficialBody:
      'Free Room Finder is an independent, non-commercial hobby project built by students for a small circle of friends. It is NOT affiliated with, endorsed by, or operated by ETH Zürich or the University of Zurich (UZH).',
    aboutDefinitionsTitle: 'What "free" and "live occupancy" mean',
    aboutDefinitionsFree:
      '"Free" strictly means no booking in the official university schedule overlaps your selected time today in Europe/Zurich. It does NOT guarantee that a room door is unlocked or that the room is physically empty. Rooms whose schedule could not be fetched are always separated under "Schedule not found" and never shown as free.',
    aboutDefinitionsOccupancy:
      'Live occupancy is available only for official ETH study spaces. It is an anonymous network-based estimate in 20% steps refreshed by ETH every 5 minutes — always treat it as an estimate.',
    aboutPrivacyTitle: 'Privacy & what this app stores',
    aboutPrivacyBody:
      'There are no user accounts, no cookies, no ads, no cross-site tracking scripts, and no external web fonts (we use cookieless Vercel Web Analytics for aggregate page-view counts only). We store official room schedules (with lecturer and organizer names removed before storage), community door-lock reports, community room-detail votes, and community-uploaded room photos after stripping 100% of EXIF/GPS metadata in both the browser and the server. To prevent duplicate votes and abuse without accounts, your browser generates a random token stored locally on your device; the server stores only a salted SHA-256 hash.',
    aboutSourcesTitle: 'Data sources & credits',
    aboutCreditsBody:
      'Official room and schedule data comes from public university pages: ETH Rauminfo (ethz.ch/rooms), ETH Student Workspaces (ethz.ch), UZH Room Occupancy Calendar (uzh.book.3vrooms.app), and UZH Student Study Rooms (campuskultur.uzh.ch). Official ETH room photos remain hosted on ETH servers and are never copied. Map tiles are provided by OpenStreetMap contributors. Inspired by the earlier student projects freiraumETHZ (nielstron) and ETH_room_viewer (benedict-armstrong); all code in this repository is original.',
    aboutContactTitle: 'Contact & removal requests',
    aboutContactBody:
      'If you have questions, feedback, or want a community photo or report removed, email:',
  },
  de: {
    appName: 'Free Room Finder',
    unofficialBadge: 'Inoffizielles Studierenden-Tool · Nicht von ETH oder UZH betrieben',
    honestFreeNotice:
      '«Frei» bedeutet: keine Buchung im offiziellen Belegungsplan überschneidet sich mit deiner Zeit. Es heisst nicht zwingend unverschlossen oder leer.',
    filterHeading: 'Freien Raum für heute finden',
    timeHeading: 'Zeit (Heute in Zürich)',
    freeFromNow: 'Ab jetzt frei',
    customWindowToday: 'Zeitfenster heute',
    windowStart: 'Von',
    windowEnd: 'Bis',
    minDuration: 'Mindestdauer frei',
    hoursUnit: 'Std.',
    minutesUnit: 'Min.',
    placeHeading: 'Ort',
    institutionLabel: 'Hochschule',
    allInstitutions: 'Beide (ETH & UZH)',
    campusLabel: 'Standort / Campus',
    allCampuses: 'Alle Standorte',
    buildingsLabel: 'Gebäude',
    searchBuildingsPlaceholder: 'Gebäude suchen (z.B. HG, CAB, KOL, Y15)...',
    selectAllOnCampus: 'Alle Gebäude an diesem Standort',
    clearBuildings: 'Auswahl löschen',
    roomTypeHeading: 'Raumtypen',
    roomTypeLectureHall: 'Hörsäle',
    roomTypeSeminarRoom: 'Seminarräume',
    roomTypeStudySpace: 'Lernplätze',
    roomTypeComputerRoom: 'Computerräume',
    roomTypeOther: 'Weitere Räume',
    capacityHeading: 'Kapazität',
    minSeatsLabel: 'Mindestanzahl Plätze',
    includeUnknownCapacity: 'Räume mit unbekannter Platzzahl einschliessen',
    searchButton: 'Freie Räume suchen',
    searching: 'Belegungspläne werden geprüft...',
    resultsHeading: 'Ergebnisse für heute',
    matchingRoomsCount: (count) =>
      count === 1 ? '1 freier Raum gefunden' : `${count} freie Räume gefunden`,
    viewList: 'Liste',
    viewTimeline: 'Zeitachse',
    viewMap: 'Karte',
    freeUntil: (hhmm) => `Frei bis ${hhmm}`,
    freeRestOfDay: 'Frei für den Rest des Tages',
    studySpaceAlwaysOpenBadge: 'Lernplatz (ohne Buchung)',
    liveOccupancyEstimateBadge: (pct, trend) => {
      const trendLabel =
        trend === 'filling'
          ? ' · Zunehmend'
          : trend === 'emptying'
            ? ' · Abnehmend'
            : trend === 'steady'
              ? ' · Stabil'
              : '';
      return `~${pct}% belegt (Schätzung)${trendLabel}`;
    },
    liveOccupancyNoSensor: 'Offener Lernplatz (kein Live-Sensor)',
    liveOccupancyHeading: 'Live-Auslastung (Schätzung, ETH Lernplatz)',
    liveOccupancyUpdated: 'Alle 5 Min. in 20%-Schritten aktualisiert (Schätzung)',
    mapSelectPinPrompt: 'Tippe auf ein Gebäude auf der Karte, um dessen freie Räume anzuzeigen.',
    mapBuildingRoomsHeading: (code, name, count) => `${code} — ${name} (${count} passend)`,
    seatsCount: (count) => (count !== null ? `${count} Plätze` : 'Plätze unbekannt'),
    unknownSeats: 'Plätze unbekannt',
    unknownScheduleGroupHeading: (count) => `Belegungsplan nicht gefunden (${count})`,
    unknownScheduleGroupDesc:
      'Diese Räume passen zu deinen Gebäude- und Typfiltern, aber ihr Belegungsplan wurde noch nicht geladen. Sie werden nie als frei markiert.',
    scheduleNotFoundBadge: 'Belegungsplan nicht gefunden',
    staleDataWarningTitle: 'Belegungsdaten sind älter als 36 Stunden',
    staleDataWarningBody: (hoursAgo) =>
      `Einige Belegungspläne wurden vor ${hoursAgo} Stunden zuletzt aktualisiert. Kurzfristige Änderungen können fehlen.`,
    simulateStaleToggle: 'Veraltete Daten simulieren (>36h)',
    offlineCachedBanner: (ageText) =>
      `Offline-Modus: zeigt die zuletzt gespeicherten Ergebnisse (${ageText}).`,
    noMatchingRooms: 'Aktuell passen keine freien Räume zu deinen Filtern.',
    tapSearchPrompt: 'Wähle oben deine Filter und tippe auf «Freie Räume suchen».',
    timelineNowLabel: 'Jetzt',
    timelineLegendFree: 'Frei',
    timelineLegendBooked: 'Belegt (schraffiert)',
    timelineLegendUnknown: 'Belegungsplan fehlt',
    roomPageBack: 'Zurück zu den Suchergebnissen',
    officialRoomLink: 'Offizielle ETH Rauminfo-Seite',
    officialUzhRoomLink: 'Offizieller UZH-Belegungskalender',
    officialUzhStudyLink: 'Offizielle UZH-Lernräume-Seite',
    officialLocationLink: 'Gebäudeplan & Standort',
    uzhLocationLink: 'UZH-Lageplan',
    buildingLabel: 'Gebäude',
    floorLabel: 'Stockwerk',
    typeLabel: 'Raumtyp',
    capacityLabel: 'Plätze',
    todayTimelineHeading: 'Heutiger Tagesverlauf (07:00 – 22:00)',
    bookingsTodayHeading: 'Offizielle Belegungen heute',
    noBookingsToday: 'Heute sind keine offiziellen Belegungen eingetragen.',
    freeGapsTodayHeading: 'Freie Zeitfenster heute',
    officialDetailsHeading: 'Raumdetails (Offiziell)',
    lastUpdatedHeading: 'Aktualität der Daten',
    scheduleLastScraped: 'Belegungsplan zuletzt geladen',
    neverScraped: 'Noch nicht geladen',
    featuresHeading: 'Ausstattung (Offiziell & Community)',
    filterRequireOutlets: 'Steckdosen',
    filterRequireBoard: 'Wandtafel / Whiteboard',
    filterRequireQuiet: 'Ruhiger Ort',
    includeUnknownFeatures: 'Räume mit unbekannter Ausstattung einschliessen',
    lockSectionHeading: 'Tür-Schliessstatus (Community)',
    lockReportOpenBtn: 'War offen',
    lockReportLockedBtn: 'War abgeschlossen',
    lockNoReportsYet: 'Noch keine Schliessmeldungen',
    lockPlainSummary: (locked, total) =>
      `Abgeschlossen in ${locked} von ${total} ${total === 1 ? 'Meldung' : 'Meldungen'}`,
    lockPatternIntro: 'Beobachtetes Muster nach Zeit:',
    lockCardHint: (locked, total) => `Zu ${locked}/${total}`,
    lockBucketLabels: {
      morning: 'Vormittag (07–12)',
      afternoon: 'Nachmittag (12–17)',
      evening: 'Abend (17–22)',
      weekday: 'Werktags',
      weekend: 'Wochenende',
    },
    detailsSectionHeading: 'Raumdetails',
    badgeOfficial: 'Offiziell',
    badgeCommunity: (votes) => `Community (${votes} ${votes === 1 ? 'Stimme' : 'Stimmen'})`,
    detailUnknownPrompt: 'Online nicht angegeben — ergänzen:',
    detailNames: {
      outlets: 'Steckdosen',
      board: 'Tafel',
      desk_type: 'Bestuhlung / Tische',
      lighting: 'Licht / Fenster',
      noise: 'Geräuschpegel',
    },
    detailValues: {
      many: 'Viele Steckdosen',
      few: 'Wenige Steckdosen',
      none: 'Keine',
      blackboard: 'Wandtafel (Kreide)',
      whiteboard: 'Whiteboard',
      both: 'Wandtafel & Whiteboard',
      fixed: 'Feste Hörsaalreihen',
      large_tables: 'Flache Tische',
      foldable: 'Klappsitze / Tablar',
      bright_daylight: 'Tageslicht / Fenster',
      artificial: 'Fensterlos / Kunstlicht',
      dim: 'Gedämpftes Licht',
      quiet: 'Ruhig',
      moderate: 'Normal',
      lively: 'Belebt',
    },
    photosSectionHeading: 'So sieht der Raum aus',
    officialPhotosBadge: 'Offizielle Raumfotos',
    communityPhotosBadge: 'Community-Fotos',
    noPhotosYet: 'Noch keine Fotos für diesen Raum vorhanden.',
    photoUploadHint: 'Hinweis: Fotografiere den Raum und die Tische — bitte keine Personen.',
    photoUploadButton: 'Raumfoto hinzufügen',
    photoUploading: 'Metadaten entfernen & hochladen...',
    communityLastUpdated: 'Letzte Community-Meldung',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeRetro: 'Retro-Terminal',
    themePastel: 'Pastell',
    themeTram: 'Züri-Tram',
    languageToggleLabel: 'Sprache',
    themeToggleLabel: 'Design',
    skipToContent: 'Zum Hauptinhalt springen',
    aboutNavLabel: 'Über',
    aboutHeading: 'Über Free Room Finder',
    aboutUnofficialTitle: 'Inoffizielles Studierendenprojekt',
    aboutUnofficialBody:
      'Free Room Finder ist ein unabhängiges, nicht-kommerzielles Hobbyprojekt von Studierenden für einen kleinen Freundeskreis. Diese App wird NICHT von der ETH Zürich oder der Universität Zürich (UZH) betrieben, unterstützt oder verantwortet.',
    aboutDefinitionsTitle: 'Was «frei» und «Live-Auslastung» bedeuten',
    aboutDefinitionsFree:
      '«Frei» bedeutet ausschliesslich, dass sich heute (Europe/Zurich) im offiziellen Belegungsplan keine Buchung mit deinem Zeitfenster überschneidet. Es garantiert NICHT, dass die Tür unverschlossen oder der Raum leer ist. Räume ohne geladenen Belegungsplan erscheinen separat unter «Belegungsplan nicht gefunden» und gelten nie als frei.',
    aboutDefinitionsOccupancy:
      'Live-Auslastung gibt es nur für offizielle ETH-Lernplätze. Es handelt sich um eine anonymisierte Schätzung der ETH in 20%-Schritten (alle 5 Minuten aktualisiert).',
    aboutPrivacyTitle: 'Datenschutz & gespeicherte Daten',
    aboutPrivacyBody:
      'Es gibt keine Benutzerkonten, keine Cookies, keine Werbung und keine extern geladenen Schriften (wir nutzen ausschliesslich cookieloses Vercel Web Analytics für aggregierte Seitenaufrufe). Gespeichert werden offizielle Raumbelegungen (ohne Namen von Dozierenden/Veranstaltenden), Community-Schliessmeldungen, Community-Abstimmungen zur Ausstattung sowie Community-Raumfotos, aus denen im Browser und auf dem Server sämtliche EXIF-/GPS-Metadaten vollständig entfernt wurden. Zur Abstimmung ohne Konto erzeugt der Browser lokal ein Zufalls-Token, von dem der Server nur einen gesalzenen SHA-256-Hash speichert.',
    aboutSourcesTitle: 'Datenquellen & Credits',
    aboutCreditsBody:
      'Die Raum- und Belegungsdaten stammen von öffentlichen Seiten: ETH Rauminfo (ethz.ch/rooms), ETH Studierenden-Arbeitsplätze (ethz.ch), UZH Belegungskalender (uzh.book.3vrooms.app) und UZH Studentische Lernräume (campuskultur.uzh.ch). Offizielle ETH-Raumfotos verbleiben auf den Servern der ETH. Kartendaten stammen von OpenStreetMap-Mitwirkenden. Inspiriert von den früheren Studierendenprojekten freiraumETHZ (nielstron) und ETH_room_viewer (benedict-armstrong); der gesamte Code ist eigenständig entwickelt.',
    aboutContactTitle: 'Kontakt & Löschanfragen',
    aboutContactBody:
      'Bei Fragen, Hinweisen oder falls ein Community-Foto bzw. ein Eintrag entfernt werden soll, schreibe bitte an:',
  },
};
