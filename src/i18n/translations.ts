import type {Language, VehicleType, ZoneRuleType, ZoneStatus} from '../types/transit';

export interface CopyDictionary {
  navLiveZones: string;
  navArrivals: string;
  navNewcomer: string;
  navManage: string;
  locateMe: string;
  locating: string;
  searchPlaceholder: string;
  searchHint: string;
  filterAll: string;
  jeep: string;
  bus: string;
  taxi: string;
  liveFeed: string;
  pausedFeed: string;
  pause: string;
  resume: string;
  spotVehicle: string;
  loadingZonesHeading: string;
  noZonesTitle: string;
  noZonesBody: string;
  pinZoneCta: string;
  arrivalsTitle: string;
  verdictYesPrefix: string;
  verdictYesSuffix: string;
  verdictNone: string;
  newcomerBadge: string;
  etaCol: string;
  vehicleCol: string;
  routeCol: string;
  loadCol: string;
  seatsAvailable: string;
  standingRoom: string;
  fullLoad: string;
  arrivingNow: string;
  minShort: string;
  kmShort: string;
  mShort: string;
  focusOnMap: string;
  newcomerSectionTitle: string;
  newcomerSectionSubtitle: string;
  zoneChecklistTitle: string;
  howToRideTitle: string;
  jeepGuideTitle: string;
  jeepGuideBody: string;
  busGuideTitle: string;
  busGuideBody: string;
  taxiGuideTitle: string;
  taxiGuideBody: string;
  manageSectionTitle: string;
  manageSectionSubtitle: string;
  pinModeOn: string;
  pinModeOff: string;
  pinInstruction: string;
  exportConfig: string;
  importConfig: string;
  resetCustom: string;
  zoneNameLabel: string;
  zoneRuleLabel: string;
  zoneStatusLabel: string;
  zoneTipLabel: string;
  allowedVehiclesLabel: string;
  saveZone: string;
  cancel: string;
  deleteZone: string;
  visibleOnMap: string;
  hiddenFromMap: string;
  spotModalTitle: string;
  spotModalSubtitle: string;
  submitSpot: string;
  mapMissingKeyTitle: string;
  mapMissingKeyBody: string;
  rules: Record<ZoneRuleType, string>;
  statuses: Record<ZoneStatus, string>;
  vehicleLabels: Record<VehicleType, string>;
}

export const TRANSLATIONS: Record<Language, CopyDictionary> = {
  en: {
    navLiveZones: 'Live Zones',
    navArrivals: 'Arrivals Board',
    navNewcomer: 'Newcomer Guide',
    navManage: 'Manage Stops',
    locateMe: 'Locate Me',
    locating: 'Locating...',
    searchPlaceholder: 'Search street, landmark, or area in the Philippines...',
    searchHint: 'Type a street or landmark to inspect nearby loading/unloading zones.',
    filterAll: 'All',
    jeep: 'Jeepney',
    bus: 'Bus',
    taxi: 'Taxi',
    liveFeed: 'Live Tracking',
    pausedFeed: 'Feed Paused',
    pause: 'Pause',
    resume: 'Resume',
    spotVehicle: 'Spot Vehicle',
    loadingZonesHeading: 'Nearby Loading & Unloading Zones',
    noZonesTitle: 'No transit zones found in this radius',
    noZonesBody: 'Search another street above or pin a custom loading/unloading zone directly on the map.',
    pinZoneCta: 'Pin Loading Zone on Map',
    arrivalsTitle: 'Approaching Vehicles & ETAs',
    verdictYesPrefix: 'Yes —',
    verdictYesSuffix: 'approaching this loading zone now.',
    verdictNone: 'No matching vehicles detected on approach right now. Try switching to All vehicles or check nearby zones.',
    newcomerBadge: 'Newcomer Check',
    etaCol: 'ETA',
    vehicleCol: 'Vehicle',
    routeCol: 'Route / Signboard',
    loadCol: 'Capacity',
    seatsAvailable: 'Seats open',
    standingRoom: 'Standing',
    fullLoad: 'Full',
    arrivingNow: 'Arriving',
    minShort: 'min',
    kmShort: 'km',
    mShort: 'm',
    focusOnMap: 'Track',
    newcomerSectionTitle: 'New to the Area? Commuter Zone Guide',
    newcomerSectionSubtitle: 'Plain guidance so first-time riders know if transport arrives here, where to stand, and how to board.',
    zoneChecklistTitle: 'Selected Loading Zone Checklist',
    howToRideTitle: 'How to Board Safely at This Zone',
    jeepGuideTitle: 'Jeepney Boarding Tips',
    jeepGuideBody: 'Check the front windshield signboard before raising your hand. Wait strictly at the painted Loading Zone sign, prepare ₱13–₱20 in small bills, and say "Para po" clearly before your stop.',
    busGuideTitle: 'City Bus Tips',
    busGuideBody: 'Buses only open doors inside marked bus bays or unloading zones. Stand behind the curb line, keep a beep/transit card or exact fare ready, and exit promptly at unloading bays.',
    taxiGuideTitle: 'Metered Taxi Tips',
    taxiGuideBody: 'Flag taxis with the lit green roof sign inside active pick-up zones. Confirm the meter is started ("Patak ng metro") upon entry and double-check your drop-off landmark.',
    manageSectionTitle: 'Manage & Curate Loading Zones',
    manageSectionSubtitle: 'Add community loading/unloading bays, set allowed vehicle types, update congestion status, and export clean configs to share with commuters.',
    pinModeOn: 'Cancel Map Pin',
    pinModeOff: 'Pin New Zone on Map',
    pinInstruction: 'Click anywhere on the map to drop a new Loading/Unloading Zone pin.',
    exportConfig: 'Export Zones JSON',
    importConfig: 'Import JSON',
    resetCustom: 'Clear Custom Zones',
    zoneNameLabel: 'Zone Name',
    zoneRuleLabel: 'Zone Rule',
    zoneStatusLabel: 'Current Status',
    zoneTipLabel: 'Newcomer Landmark Tip',
    allowedVehiclesLabel: 'Allowed Vehicles',
    saveZone: 'Save Zone',
    cancel: 'Cancel',
    deleteZone: 'Remove',
    visibleOnMap: 'Shown',
    hiddenFromMap: 'Hidden',
    spotModalTitle: 'Report Approaching Vehicle',
    spotModalSubtitle: 'Spotted a Jeepney, Bus, or Taxi heading toward this loading zone? Add it to the live board for fellow commuters.',
    submitSpot: 'Add to Live Board',
    mapMissingKeyTitle: 'Map unavailable',
    mapMissingKeyBody: 'Unable to initialize the OpenStreetMap layer right now.',
    rules: {
      loading_unloading: 'Loading & Unloading',
      loading_only: 'Loading Only (Sakayan)',
      unloading_only: 'Unloading Only (Babaan)',
    },
    statuses: {
      active: 'Active',
      congested: 'Heavy Traffic',
      closed: 'Temporarily Closed',
    },
    vehicleLabels: {
      jeep: 'Jeepney',
      bus: 'Bus',
      taxi: 'Taxi',
    },
  },
  fil: {
    navLiveZones: 'Live Zones',
    navArrivals: 'Mga Darating',
    navNewcomer: 'Gabay sa Bago',
    navManage: 'Pamahalaan',
    locateMe: 'Lokasyon Ko',
    locating: 'Hinahanap...',
    searchPlaceholder: 'Maghanap ng kalye, landmark, o lugar sa Pilipinas...',
    searchHint: 'Mag-type ng kalye o landmark para makita ang malapit na sakayan/babaan.',
    filterAll: 'Lahat',
    jeep: 'Jeepney',
    bus: 'Bus',
    taxi: 'Taxi',
    liveFeed: 'Live na Galaw',
    pausedFeed: 'Naka-pause',
    pause: 'I-pause',
    resume: 'Ituloy',
    spotVehicle: 'Mag-report',
    loadingZonesHeading: 'Malalapit na Loading & Unloading Zones',
    noZonesTitle: 'Walang nahanap na sakayan sa paligid',
    noZonesBody: 'Maghanap ng ibang kalye sa itaas o mag-pin ng bagong loading/unloading zone sa mapa.',
    pinZoneCta: 'Mag-pin ng Zone sa Mapa',
    arrivalsTitle: 'Mga Paparating na Sasakyan at ETA',
    verdictYesPrefix: 'Oo — may',
    verdictYesSuffix: 'na paparating sa loading zone na ito ngayon.',
    verdictNone: 'Walang napiling sasakyan na paparating sa ngayon. Subukan i-click ang "Lahat" o pumili ng ibang zone.',
    newcomerBadge: 'Gabay sa Bago sa Lugar',
    etaCol: 'Darating',
    vehicleCol: 'Sasakyan',
    routeCol: 'Ruta / Karatula',
    loadCol: 'Laman',
    seatsAvailable: 'May upuan',
    standingRoom: 'Tayuan',
    fullLoad: 'Puno na',
    arrivingNow: 'Nandito na',
    minShort: 'min',
    kmShort: 'km',
    mShort: 'm',
    focusOnMap: 'Tingnan',
    newcomerSectionTitle: 'Bago Ka Lang sa Lugar? Gabay sa Commuter',
    newcomerSectionSubtitle: 'Simpleng gabay para malaman agad kung may dumadaang sakayan, saan tatayo, at paano sumakay.',
    zoneChecklistTitle: 'Detalye ng Napiling Sakayan / Babaan',
    howToRideTitle: 'Paano Sumakay Nang Ligtas Dito',
    jeepGuideTitle: 'Gabay sa Pagsakay ng Jeepney',
    jeepGuideBody: 'Basahin muna ang karatula sa harap bago pumara. Maghintay sa mismong Loading Zone sign, maghanda ng ₱13–₱20 na barya, at magsabi ng "Para po" nang maaga.',
    busGuideTitle: 'Gabay sa Pagsakay ng Bus',
    busGuideBody: 'Sa markadong bus bay o unloading zone lang nagbubukas ng pinto ang bus. Pumila nang maayos sa gilid ng bangketa at ihanda ang beep card o eksaktong pamasahe.',
    taxiGuideTitle: 'Gabay sa Pagsakay ng Taxi',
    taxiGuideBody: 'Pumara ng taxi na may nakasinding berdeng ilaw sa bubong sa loob ng tamang pick-up zone. Siguraduhing naka-on ang metro bago umalis.',
    manageSectionTitle: 'Pamahalaan at Ayusin ang mga Loading Zone',
    manageSectionSubtitle: 'Magdagdag ng sakayan/babaan sa mapa, itakda ang pwede sumakay (Jeep/Bus/Taxi), i-update ang lagay ng trapiko, at i-export para maibahagi sa iba.',
    pinModeOn: 'Itigil ang Pag-pin',
    pinModeOff: 'Mag-pin ng Bagong Zone',
    pinInstruction: 'I-click kahit saan sa mapa para maglagay ng bagong Loading/Unloading Zone.',
    exportConfig: 'I-export ang Zones',
    importConfig: 'Mag-import ng JSON',
    resetCustom: 'Burahin ang Custom',
    zoneNameLabel: 'Pangalan ng Zone',
    zoneRuleLabel: 'Patakaran ng Zone',
    zoneStatusLabel: 'Kasalukuyang Lagay',
    zoneTipLabel: 'Paalala sa Bago sa Lugar',
    allowedVehiclesLabel: 'Mga Pinapayagang Sasakyan',
    saveZone: 'I-save ang Zone',
    cancel: 'Kanselahin',
    deleteZone: 'Alisin',
    visibleOnMap: 'Nakikita',
    hiddenFromMap: 'Nakatago',
    spotModalTitle: 'Mag-report ng Paparating na Sasakyan',
    spotModalSubtitle: 'May nakita ka bang Jeepney, Bus, o Taxi na paparating dito? Idagdag sa live list para makita ng ibang pasahero.',
    submitSpot: 'Idagdag sa Live List',
    mapMissingKeyTitle: 'Hindi ma-load ang mapa',
    mapMissingKeyBody: 'Hindi ma-load ang OpenStreetMap layer sa ngayon.',
    rules: {
      loading_unloading: 'Sakayan at Babaan',
      loading_only: 'Sakayan Lang (Loading Only)',
      unloading_only: 'Babaan Lang (Unloading Only)',
    },
    statuses: {
      active: 'Aktibo',
      congested: 'Matrapik',
      closed: 'Sarado Pansamantala',
    },
    vehicleLabels: {
      jeep: 'Jeepney',
      bus: 'Bus',
      taxi: 'Taxi',
    },
  },
};
