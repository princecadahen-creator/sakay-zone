import type {Language, VehicleType, ZoneRuleType, ZoneStatus} from '../types/transit';

export interface CopyDictionary {
  navLiveZones: string;
  navArrivals: string;
  navNewcomer: string;
  navManage: string;
  locateMe: string;
  locating: string;
  signIn: string;
  signOut: string;
  signInToContribute: string;
  shareToTikTok: string;
  tiktokModalTitle: string;
  tiktokModalSubtitle: string;
  tiktokShareAction: string;
  tiktokDownloadPng: string;
  tiktokDownloadFallback: string;
  jeepRadarTitle: string;
  jeepRadarLive: string;
  jeepRadarNone: string;
  liveCountSuffix: string;
  noLiveModeYet: string;
  reportQuickBtn: string;
  broadcastActiveLabel: string;
  ridingOrDrivingCta: string;
  routesCountSuffix: string;
  baysCountSuffix: string;
  clickRouteHint: string;
  routeFilterPlaceholder: string;
  alertOnLabel: string;
  alertOffLabel: string;
  savedAreasLabel: string;
  searchPlaceholder: string;
  searchHint: string;
  filterAll: string;
  jeep: string;
  bus: string;
  taxi: string;
  shareRide: string;
  stopSharingRide: string;
  sharingLiveTitle: string;
  sharingLiveHint: string;
  startBroadcastBtn: string;
  imWaiting: string;
  stopWaiting: string;
  waitingHereSuffix: string;
  reportConditionBtn: string;
  queueNotePlaceholder: string;
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
  liveGpsLabel: string;
  communityReportedLabel: string;
  mappedRoutesTitle: string;
  mappedRoutesSubtitle: string;
  noMappedRoutes: string;
  walkingToStopLabel: string;
  weatherRainAlert: string;
  weatherClearLabel: string;
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
  rules: Record<ZoneRuleType, string>;
  statuses: Record<ZoneStatus, string>;
  vehicleLabels: Record<VehicleType, string>;
}

export const TRANSLATIONS: Record<Language, CopyDictionary> = {
  en: {
    navLiveZones: 'Live Zones',
    navArrivals: 'Live Feed',
    navNewcomer: 'Newcomer Guide',
    navManage: 'Manage Stops',
    locateMe: 'Locate Me',
    locating: 'Locating...',
    signIn: 'Sign In',
    signOut: 'Sign Out',
    signInToContribute: 'Sign in with Google to share live GPS, spot vehicles, or pin stops for everyone.',
    shareToTikTok: 'Share to TikTok',
    tiktokModalTitle: 'Share Live SakayZone Card to TikTok',
    tiktokModalSubtitle: 'Instant 9:16 summary screenshot of this loading zone’s live rides, queue, and weather — ready to post or download.',
    tiktokShareAction: 'Share to TikTok / Apps',
    tiktokDownloadPng: 'Download Picture (PNG)',
    tiktokDownloadFallback: 'Picture downloaded! Open TikTok and select this PNG from your gallery.',
    jeepRadarTitle: 'Live Jeepney, Bus & Taxi Availability',
    jeepRadarLive: 'Live Jeepney approaching now',
    jeepRadarNone: 'No live Jeepney GPS or sighting here yet',
    liveCountSuffix: 'live',
    noLiveModeYet: 'No live ping yet',
    reportQuickBtn: 'Report',
    broadcastActiveLabel: 'Broadcasting your Live GPS now:',
    ridingOrDrivingCta: 'Inside a Jeep/Bus/Taxi? Share Live GPS',
    routesCountSuffix: 'routes',
    baysCountSuffix: 'stops / bays',
    clickRouteHint: 'Tap any route to highlight it on the map',
    routeFilterPlaceholder: 'Filter routes or destination (e.g. Cubao, Ayala)...',
    alertOnLabel: 'Sound Alert On',
    alertOffLabel: 'Alert on Arrival',
    savedAreasLabel: 'Offline Saved Areas:',
    searchPlaceholder: 'Search street, landmark, or town in the Philippines...',
    searchHint: 'Real OpenStreetMap stops, transit routes, live weather, and shared commuter updates.',
    filterAll: 'All',
    jeep: 'Jeepney',
    bus: 'Bus',
    taxi: 'Taxi',
    shareRide: 'Share Live GPS',
    stopSharingRide: 'Stop Live GPS',
    sharingLiveTitle: 'Broadcast Live Trip (Driver or Passenger)',
    sharingLiveHint: 'Currently riding or driving a PUV? Share real phone GPS so waiting commuters see your live ETA.',
    startBroadcastBtn: 'Start Live GPS',
    imWaiting: 'I am Waiting Here',
    stopWaiting: 'Leave Queue',
    waitingHereSuffix: 'waiting here',
    reportConditionBtn: 'Update Queue / Traffic',
    queueNotePlaceholder: 'Optional note (e.g. Long line for Fairview jeeps)',
    spotVehicle: 'Spot Vehicle',
    loadingZonesHeading: 'Nearby Loading & Unloading Zones',
    noZonesTitle: 'No mapped stops in this radius yet',
    noZonesBody: 'Search another street above or pin a verified loading/unloading zone directly on the map.',
    pinZoneCta: 'Pin Loading Zone',
    arrivalsTitle: 'Live Vehicles & Sightings',
    verdictYesPrefix: 'Live right now —',
    verdictYesSuffix: 'reported or sharing GPS near this loading zone.',
    verdictNone: 'No live GPS riders or recent sightings at this stop right now. Check the real OpenStreetMap routes below or tap Spot Vehicle / Share Live GPS if you see one.',
    newcomerBadge: 'Live Commuter Check',
    etaCol: 'ETA',
    vehicleCol: 'Vehicle',
    routeCol: 'Route / Source',
    loadCol: 'Capacity',
    seatsAvailable: 'Seats open',
    standingRoom: 'Standing',
    fullLoad: 'Full',
    arrivingNow: 'Arriving',
    minShort: 'min',
    kmShort: 'km',
    mShort: 'm',
    liveGpsLabel: 'LIVE GPS',
    communityReportedLabel: 'Community spotted',
    mappedRoutesTitle: 'Real Transit Routes Mapped Nearby',
    mappedRoutesSubtitle: 'Public jeepney, bus, and rail routes registered on OpenStreetMap passing within 1.2 km.',
    noMappedRoutes: 'No numbered OpenStreetMap route relations tagged here yet. Ask locals or check signboard names along the highway.',
    walkingToStopLabel: 'Walk from your GPS',
    weatherRainAlert: 'Rain detected at this stop — expect slower traffic & bring an umbrella.',
    weatherClearLabel: 'Dry weather at stop',
    newcomerSectionTitle: 'New to the Area? Commuter Zone Guide',
    newcomerSectionSubtitle: 'Verified stop details, live weather, walking distance, and safe Philippine boarding rules.',
    zoneChecklistTitle: 'Selected Loading Zone Checklist',
    howToRideTitle: 'How to Board Safely at This Zone',
    jeepGuideTitle: 'Jeepney Boarding Tips',
    jeepGuideBody: 'Check the front windshield signboard before raising your hand. Wait strictly at the painted Loading Zone sign, prepare ₱13–₱20 in small bills, and say "Para po" clearly before your stop.',
    busGuideTitle: 'City Bus Tips',
    busGuideBody: 'Buses only open doors inside marked bus bays or unloading zones. Stand behind the curb line, keep a beep/transit card or exact fare ready, and exit promptly at unloading bays.',
    taxiGuideTitle: 'Metered Taxi Tips',
    taxiGuideBody: 'Flag taxis with the lit green roof sign inside active pick-up zones. Confirm the meter is started ("Patak ng metro") upon entry and double-check your drop-off landmark.',
    manageSectionTitle: 'Manage & Share Community Loading Zones',
    manageSectionSubtitle: 'Pin real local sakayan/babaan spots, update queue status for everyone, and export clean configs.',
    pinModeOn: 'Cancel Map Pin',
    pinModeOff: 'Pin New Zone on Map',
    pinInstruction: 'Click anywhere on the map to drop a new shared Loading/Unloading Zone pin.',
    exportConfig: 'Export Zones JSON',
    importConfig: 'Import JSON',
    resetCustom: 'Clear Local Cache',
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
    spotModalTitle: 'Report a Real Approaching Ride',
    spotModalSubtitle: 'Spotted an actual Jeepney, Bus, or Taxi heading toward this stop? Your sighting stays live for 15 minutes for fellow commuters.',
    submitSpot: 'Publish Live Sighting',
    rules: {
      loading_unloading: 'Loading & Unloading',
      loading_only: 'Loading Only (Sakayan)',
      unloading_only: 'Unloading Only (Babaan)',
    },
    statuses: {
      active: 'Active / Smooth',
      congested: 'Heavy Traffic / Queue',
      closed: 'No Rides / Closed',
    },
    vehicleLabels: {
      jeep: 'Jeepney',
      bus: 'Bus',
      taxi: 'Taxi',
    },
  },
  fil: {
    navLiveZones: 'Live Zones',
    navArrivals: 'Live na Sakayan',
    navNewcomer: 'Gabay sa Bago',
    navManage: 'Pamahalaan',
    locateMe: 'Lokasyon Ko',
    locating: 'Hinahanap...',
    signIn: 'Mag-sign In',
    signOut: 'Sign Out',
    signInToContribute: 'Mag-sign in gamit ang Google para makapag-share ng live GPS, makapag-report ng sasakyan, o makapag-pin ng sakayan para sa lahat.',
    shareToTikTok: 'Share sa TikTok',
    tiktokModalTitle: 'I-share ang Live Pic sa TikTok',
    tiktokModalSubtitle: 'Instant 9:16 summary picture ng lagay ng sakayan ngayon (live na jeep, pila, at panahon) — pwedeng i-download o i-share agad.',
    tiktokShareAction: 'I-share sa TikTok / Apps',
    tiktokDownloadPng: 'I-download ang Pic (PNG)',
    tiktokDownloadFallback: 'Na-download na ang picture! Buksan ang TikTok at piliin ito sa gallery mo.',
    jeepRadarTitle: 'Live Radar: May Jeep, Bus, o Taxi ba ngayon?',
    jeepRadarLive: 'May live na Jeepney na paparating ngayon',
    jeepRadarNone: 'Wala pang live Jeepney GPS o bagong report dito ngayon',
    liveCountSuffix: 'live',
    noLiveModeYet: 'Wala pang live ping',
    reportQuickBtn: 'I-report',
    broadcastActiveLabel: 'Naka-broadcast ngayon ang Live GPS mo:',
    ridingOrDrivingCta: 'Nakasakay o driver ka? I-share Live GPS',
    routesCountSuffix: 'ruta',
    baysCountSuffix: 'sakayan / bay',
    clickRouteHint: 'I-tap ang ruta para makita agad sa mapa',
    routeFilterPlaceholder: 'Hanapin ang ruta o destinasyon (hal. Cubao, Ayala)...',
    alertOnLabel: 'Naka-on ang Tunog',
    alertOffLabel: 'Tunog Pag May Sasakyan',
    savedAreasLabel: 'Naka-save (Walang Data OK):',
    searchPlaceholder: 'Maghanap ng kalye, landmark, o bayan sa Pilipinas...',
    searchHint: 'Totoong stops at ruta mula OpenStreetMap, live na panahon, at real-time updates ng mga pasahero.',
    filterAll: 'Lahat',
    jeep: 'Jeepney',
    bus: 'Bus',
    taxi: 'Taxi',
    shareRide: 'I-share Live GPS',
    stopSharingRide: 'Itigil Live GPS',
    sharingLiveTitle: 'I-broadcast ang Biyahe (Driver o Pasahero)',
    sharingLiveHint: 'Nakasakay o nagmamaneho ka ba ngayon? I-share ang totoong GPS ng phone para makita ng mga naghihintay sa sakayan.',
    startBroadcastBtn: 'Simulan Live GPS',
    imWaiting: 'Naghihintay Ako Dito',
    stopWaiting: 'Umalis sa Pila',
    waitingHereSuffix: 'naghihintay dito',
    reportConditionBtn: 'I-update ang Pila / Trapik',
    queueNotePlaceholder: 'Paalala (hal. Mahaba ang pila ng jeep pa-Cubao)',
    spotVehicle: 'Mag-report',
    loadingZonesHeading: 'Malalapit na Loading & Unloading Zones',
    noZonesTitle: 'Walang naka-map na sakayan sa paligid',
    noZonesBody: 'Maghanap ng ibang kalye sa itaas o mag-pin ng totoong loading/unloading zone sa mapa.',
    pinZoneCta: 'Mag-pin ng Zone',
    arrivalsTitle: 'Live na Sasakyan at Sightings',
    verdictYesPrefix: 'Live ngayon — may',
    verdictYesSuffix: 'na naka-share ng GPS o na-report malapit sa sakayang ito.',
    verdictNone: 'Wala pang naka-share na live GPS o bagong report sa sakayang ito ngayon. Tingnan ang totoong rutang nakamapa sa baba o i-tap ang Mag-report / I-share Live GPS kung may nakita ka.',
    newcomerBadge: 'Live Check sa Sakayan',
    etaCol: 'Darating',
    vehicleCol: 'Sasakyan',
    routeCol: 'Ruta / Pinagmulan',
    loadCol: 'Laman',
    seatsAvailable: 'May upuan',
    standingRoom: 'Tayuan',
    fullLoad: 'Puno na',
    arrivingNow: 'Nandito na',
    minShort: 'min',
    kmShort: 'km',
    mShort: 'm',
    liveGpsLabel: 'LIVE GPS',
    communityReportedLabel: 'Ni-report ng pasahero',
    mappedRoutesTitle: 'Mga Totoong Rutang Dumadaan Dito',
    mappedRoutesSubtitle: 'Mga rehistradong ruta ng jeep, bus, at tren sa OpenStreetMap sa loob ng 1.2 km.',
    noMappedRoutes: 'Wala pang nakalagay na route tag sa OpenStreetMap dito. Magtanong sa sakayan o basahin ang karatula sa highway.',
    walkingToStopLabel: 'Lakad mula sa GPS mo',
    weatherRainAlert: 'Umuulan sa lugar na ito — asahan ang mas mabagal na sakayan at magdala ng payong.',
    weatherClearLabel: 'Maayos ang panahon sa sakayan',
    newcomerSectionTitle: 'Bago Ka Lang sa Lugar? Gabay sa Commuter',
    newcomerSectionSubtitle: 'Totoong detalye ng sakayan, lagay ng panahon, layo ng lakad, at paalala sa pagsakay.',
    zoneChecklistTitle: 'Detalye ng Napiling Sakayan / Babaan',
    howToRideTitle: 'Paano Sumakay Nang Ligtas Dito',
    jeepGuideTitle: 'Gabay sa Pagsakay ng Jeepney',
    jeepGuideBody: 'Basahin muna ang karatula sa harap bago pumara. Maghintay sa mismong Loading Zone sign, maghanda ng ₱13–₱20 na barya, at magsabi ng "Para po" nang maaga.',
    busGuideTitle: 'Gabay sa Pagsakay ng Bus',
    busGuideBody: 'Sa markadong bus bay o unloading zone lang nagbubukas ng pinto ang bus. Pumila nang maayos sa gilid ng bangketa at ihanda ang beep card o eksaktong pamasahe.',
    taxiGuideTitle: 'Gabay sa Pagsakay ng Taxi',
    taxiGuideBody: 'Pumara ng taxi na may nakasinding berdeng ilaw sa bubong sa loob ng tamang pick-up zone. Siguraduhing naka-on ang metro bago umalis.',
    manageSectionTitle: 'Pamahalaan at Ibahagi ang mga Loading Zone',
    manageSectionSubtitle: 'Mag-pin ng totoong sakayan/babaan sa mapa para makita at magamit ng lahat ng commuter.',
    pinModeOn: 'Itigil ang Pag-pin',
    pinModeOff: 'Mag-pin ng Bagong Zone',
    pinInstruction: 'I-click kahit saan sa mapa para maglagay ng bagong shared Loading/Unloading Zone.',
    exportConfig: 'I-export ang Zones',
    importConfig: 'Mag-import ng JSON',
    resetCustom: 'Linisin ang Cache',
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
    spotModalTitle: 'Mag-report ng Totoong Sasakyan',
    spotModalSubtitle: 'May nakita ka bang totoong Jeepney, Bus, o Taxi na paparating dito? Mananatili itong live sa loob ng 15 minuto para sa ibang pasahero.',
    submitSpot: 'I-post ang Live Report',
    rules: {
      loading_unloading: 'Sakayan at Babaan',
      loading_only: 'Sakayan Lang (Loading Only)',
      unloading_only: 'Babaan Lang (Unloading Only)',
    },
    statuses: {
      active: 'Aktibo / Maluwag',
      congested: 'Matrapik / Mahaba Pila',
      closed: 'Walang Biyahe / Sarado',
    },
    vehicleLabels: {
      jeep: 'Jeepney',
      bus: 'Bus',
      taxi: 'Taxi',
    },
  },
};
