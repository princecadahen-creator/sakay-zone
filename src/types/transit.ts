export type VehicleType = 'jeep' | 'bus' | 'taxi';

export type ZoneRuleType = 'loading_unloading' | 'loading_only' | 'unloading_only';

export type ZoneStatus = 'active' | 'congested' | 'closed';

export type Language = 'en' | 'fil';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface LoadingZone {
  id: string;
  placeId?: string;
  name: string;
  address: string;
  location: LatLngPoint;
  source: 'places' | 'custom';
  allowedVehicles: VehicleType[];
  ruleType: ZoneRuleType;
  status: ZoneStatus;
  landmarkTip: string;
  fareRange: string;
  routeRefs?: string[];
  hidden?: boolean;
  authorUid?: string;
  authorName?: string;
  queueNote?: string;
  statusUpdatedAtMs?: number;
  statusReporterName?: string;
}

export interface TrackedVehicle {
  id: string;
  type: VehicleType;
  routeCode: string;
  routeLabel: string;
  destination: string;
  plateNumber: string;
  occupancy: 'seats' | 'standing' | 'full';
  fareText: string;
  path: LatLngPoint[];
  progress: number;
  speedMps: number;
  totalMeters: number;
  distanceMeters: number;
  etaSeconds: number;
  position: LatLngPoint;
  heading: number;
  targetZoneId: string;
  liveMode: 'gps' | 'community';
  reporterName?: string;
  reportedAtMs?: number;
  freshnessSec?: number;
  speedKmh?: number;
  isSelf?: boolean;
}

export interface MappedTransitRoute {
  id: string;
  ref: string;
  name: string;
  mode: 'jeep' | 'bus' | 'taxi' | 'rail' | 'ferry';
  from?: string;
  to?: string;
  operator?: string;
  paths?: LatLngPoint[][];
  focusPoint?: LatLngPoint;
  sourceKind?: 'osm-relation' | 'osm-stop-tag' | 'osm-taxi-bay';
}

export interface ZoneWeatherInfo {
  temperatureC: number;
  precipitationMm: number;
  weatherCode: number;
  isRainy: boolean;
}

export interface CommunityZoneRecord {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  allowedVehicles: VehicleType[];
  ruleType: ZoneRuleType;
  status: ZoneStatus;
  landmarkTip: string;
  fareRange: string;
  authorUid: string;
  authorName: string;
  isPublic: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ZoneStatusReportRecord {
  zoneId: string;
  zoneName: string;
  status: ZoneStatus;
  queueNote: string;
  reporterUid: string;
  reporterName: string;
  updatedAtMs: number;
}

export interface VehicleSightingRecord {
  id: string;
  zoneId: string;
  zoneName: string;
  type: VehicleType;
  routeLabel: string;
  occupancy: 'seats' | 'standing' | 'full';
  etaMinutes: number;
  zoneLat: number;
  zoneLng: number;
  reporterUid: string;
  reporterName: string;
  expiresAtMs: number;
  createdAtMs: number;
}

export interface LiveGpsTripRecord {
  tripId: string;
  driverUid: string;
  displayName: string;
  type: VehicleType;
  routeLabel: string;
  occupancy: 'seats' | 'standing' | 'full';
  lat: number;
  lng: number;
  speedMps: number;
  heading: number;
  active: boolean;
  updatedAtMs: number;
}

export interface WaitingCheckinRecord {
  checkinId: string;
  userUid: string;
  zoneId: string;
  zoneName: string;
  vehicleWanted: 'all' | VehicleType;
  updatedAtMs: number;
}
