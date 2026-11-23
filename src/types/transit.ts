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
  hidden?: boolean;
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
  /** Normalized progress along `path` from 0 (approach start) to 1 (loading zone) */
  progress: number;
  speedMps: number;
  totalMeters: number;
  distanceMeters: number;
  etaSeconds: number;
  position: LatLngPoint;
  heading: number;
  targetZoneId: string;
  isUserSpotted?: boolean;
}
