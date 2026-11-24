import type {
  LatLngPoint,
  LiveGpsTripRecord,
  LoadingZone,
  MappedTransitRoute,
  TrackedVehicle,
  VehicleSightingRecord,
  VehicleType,
  ZoneRuleType,
  ZoneWeatherInfo,
} from '../types/transit';

/**
 * Haversine distance in meters between two coordinates.
 */
export function distanceMetersBetween(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Geographic bearing in degrees (0 = North, 90 = East).
 */
export function bearingDegrees(from: LatLngPoint, to: LatLngPoint): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Interpolates a coordinate and heading along a road polyline at normalized t in [0, 1].
 */
export function interpolateAlongPath(
  path: LatLngPoint[],
  t: number
): {position: LatLngPoint; heading: number; totalMeters: number} {
  if (path.length === 0) {
    return {position: {lat: 14.5995, lng: 120.9842}, heading: 0, totalMeters: 0};
  }
  if (path.length === 1) {
    return {position: path[0], heading: 0, totalMeters: 0};
  }

  const segLengths: number[] = [];
  let totalMeters = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = distanceMetersBetween(path[i], path[i + 1]);
    segLengths.push(len);
    totalMeters += len;
  }

  if (totalMeters <= 0.5) {
    return {
      position: path[path.length - 1],
      heading: bearingDegrees(path[0], path[path.length - 1]),
      totalMeters: 1,
    };
  }

  const clamped = Math.max(0, Math.min(1, t));
  const targetDist = clamped * totalMeters;
  let accum = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist || i === segLengths.length - 1) {
      const localT = segLen > 0 ? (targetDist - accum) / segLen : 0;
      const p1 = path[i];
      const p2 = path[i + 1];
      return {
        position: {
          lat: p1.lat + (p2.lat - p1.lat) * localT,
          lng: p1.lng + (p2.lng - p1.lng) * localT,
        },
        heading: bearingDegrees(p1, p2),
        totalMeters,
      };
    }
    accum += segLen;
  }

  const lastIdx = path.length - 1;
  return {
    position: path[lastIdx],
    heading: bearingDegrees(path[lastIdx - 1], path[lastIdx]),
    totalMeters,
  };
}

interface OverpassMember {
  type?: string;
  role?: string;
  geometry?: Array<{lat: number; lon: number}>;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {lat: number; lon: number};
  tags?: Record<string, string>;
  members?: OverpassMember[];
}

function inferAllowedFromTags(tags: Record<string, string>, name: string): VehicleType[] {
  const lower = name.toLowerCase();
  if (tags.amenity === 'taxi' || lower.includes('taxi')) {
    return ['taxi', 'jeep'];
  }
  if (tags.amenity === 'bus_station' || lower.includes('bus') || lower.includes('terminal')) {
    return ['bus', 'jeep', 'taxi'];
  }
  if (lower.includes('jeep') || lower.includes('toda') || lower.includes('uv')) {
    return ['jeep', 'taxi'];
  }
  return ['jeep', 'bus', 'taxi'];
}

function inferRuleFromName(name: string): ZoneRuleType {
  const lower = name.toLowerCase();
  if (lower.includes('unloading') || lower.includes('babaan')) {
    return 'unloading_only';
  }
  if (lower.includes('terminal') || lower.includes('loading only')) {
    return 'loading_only';
  }
  return 'loading_unloading';
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function fetchOverpassJson(
  query: string,
  timeoutMs = 5500
): Promise<{elements?: OverpassElement[]} | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (res.ok) {
        return (await res.json()) as {elements?: OverpassElement[]};
      }
    } catch {
      // Try next Overpass mirror
    }
  }
  return null;
}

/**
 * Discovers real nearby transit stops, terminals, bus stops, and taxi stands
 * using the free OpenStreetMap Overpass API, with a road-snapped OSRM fallback
 * so smaller Philippine towns still offer road-snapped pickup points.
 */
export async function discoverNearbyLoadingZones(
  center: LatLngPoint,
  areaLabel?: string
): Promise<LoadingZone[]> {
  const zonesById: Record<string, LoadingZone> = {};

  const query = `
    [out:json][timeout:6];
    (
      node["highway"="bus_stop"](around:1800,${center.lat},${center.lng});
      node["amenity"="bus_station"](around:1800,${center.lat},${center.lng});
      way["amenity"="bus_station"](around:1800,${center.lat},${center.lng});
      node["amenity"="taxi"](around:1800,${center.lat},${center.lng});
      node["public_transport"="platform"](around:1800,${center.lat},${center.lng});
      node["railway"~"station|halt"](around:1800,${center.lat},${center.lng});
    );
    out center 15;
  `;

  try {
    const data = await fetchOverpassJson(query, 5500);
    if (data) {
      for (const el of data.elements ?? []) {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;

        const tags = el.tags ?? {};
        const name =
          tags.name ||
          tags.official_name ||
          (tags.amenity === 'taxi'
            ? 'Taxi Stand Loading Zone'
            : tags.amenity === 'bus_station'
              ? 'Bus & Jeepney Terminal'
              : 'Roadside Loading / Unloading Stop');

        const street = tags['addr:street'] || tags.road || tags.operator || areaLabel || 'Nearby street';
        const allowedVehicles = inferAllowedFromTags(tags, name);
        const id = `osm-${el.type}-${el.id}`;
        const rawRouteRef = tags.route_ref || tags.routes || tags.destination || '';
        const routeRefs = rawRouteRef
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8);

        zonesById[id] = {
          id,
          name,
          address: street,
          location: {lat, lng},
          source: 'places',
          allowedVehicles,
          ruleType: inferRuleFromName(name),
          status: 'active',
          landmarkTip:
            routeRefs.length > 0
              ? `OpenStreetMap stop near ${street}. Signboards/Routes tagged: ${routeRefs.join(', ')}.`
              : `OpenStreetMap transit stop near ${street}. Stand safely behind the curb and verify the vehicle signboard before boarding.`,
          fareRange: allowedVehicles.includes('bus') ? '₱13 – ₱35' : '₱13 – ₱20',
          routeRefs: routeRefs.length > 0 ? routeRefs : undefined,
        };
      }
    }
  } catch {
    // Gracefully fall through to OSRM road-snapped stops if Overpass times out
  }

  if (Object.keys(zonesById).length < 2) {
    const candidateOffsets: Array<{offset: LatLngPoint; suffix: string; vehicles: VehicleType[]}> = [
      {
        offset: {lat: center.lat, lng: center.lng},
        suffix: 'Roadside Loading Bay',
        vehicles: ['jeep', 'bus', 'taxi'],
      },
      {
        offset: {lat: center.lat + 0.0028, lng: center.lng + 0.0018},
        suffix: 'Northbound Roadside Stop',
        vehicles: ['jeep', 'taxi'],
      },
    ];

    const snapped = await Promise.all(
      candidateOffsets.map(async (item, idx) => {
        let finalLoc = item.offset;
        let streetName = areaLabel || 'National Highway';
        try {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 3500);
          const url = `https://router.project-osrm.org/nearest/v1/driving/${item.offset.lng},${item.offset.lat}?number=1`;
          const res = await fetch(url, {signal: controller.signal});
          window.clearTimeout(timer);
          if (res.ok) {
            const json = (await res.json()) as {
              waypoints?: Array<{location?: [number, number]; name?: string}>;
            };
            const wp = json.waypoints?.[0];
            if (wp?.location && wp.location.length === 2) {
              finalLoc = {lat: wp.location[1], lng: wp.location[0]};
            }
            if (wp?.name) {
              streetName = wp.name;
            }
          }
        } catch {
          // Use offset point cleanly
        }

        const labelBase = streetName || areaLabel || 'Town Center';
        const latKey = finalLoc.lat.toFixed(4).replace('.', '_');
        const lngKey = finalLoc.lng.toFixed(4).replace('.', '_');
        const zone: LoadingZone = {
          id: `road-${idx}-${latKey}-${lngKey}`,
          name: `${labelBase} — ${item.suffix}`,
          address: streetName,
          location: finalLoc,
          source: 'places',
          allowedVehicles: item.vehicles,
          ruleType: 'loading_unloading',
          status: 'active',
          landmarkTip: `Road-snapped point along ${streetName}. Pin exact local terminals or tricycle/jeepney waiting sheds under Manage Stops to help commuters.`,
          fareRange: item.vehicles.includes('bus') ? '₱13 – ₱35' : '₱13 – ₱20',
        };
        return zone;
      })
    );

    for (const z of snapped) {
      if (!zonesById[z.id]) {
        zonesById[z.id] = z;
      }
    }
  }

  return Object.values(zonesById).sort(
    (a, b) => distanceMetersBetween(center, a.location) - distanceMetersBetween(center, b.location)
  );
}

/**
 * Discovers REAL mapped public transit routes (jeepney/share_taxi, bus, taxi stands, rail, ferry)
 * AND their road geometry passing near the searched location via OpenStreetMap Overpass API.
 */
export async function discoverMappedRoutesNear(
  center: LatLngPoint
): Promise<MappedTransitRoute[]> {
  const query = `
    [out:json][timeout:7];
    (
      relation["route"~"bus|share_taxi|minibus|light_rail|subway|rail|ferry"](around:2200,${center.lat},${center.lng});
    );
    out geom 18;
    (
      node["route_ref"](around:2200,${center.lat},${center.lng});
      node["amenity"~"taxi|bus_station"](around:2200,${center.lat},${center.lng});
      way["amenity"~"taxi|bus_station"](around:2200,${center.lat},${center.lng});
    );
    out center 20;
  `;

  try {
    const data = await fetchOverpassJson(query, 6500);
    if (!data) return [];
    const seenKeys: Record<string, boolean> = {};
    const routes: MappedTransitRoute[] = [];

    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};

      if (el.type === 'relation') {
        const routeType = tags.route ?? 'bus';
        const name = tags.name || `${tags.from ?? 'Origin'} → ${tags.to ?? 'Destination'}`;
        const key = `rel:${name.toLowerCase()}`;
        if (!name || seenKeys[key]) continue;
        seenKeys[key] = true;

        let mode: MappedTransitRoute['mode'] = 'bus';
        if (
          routeType === 'share_taxi' ||
          routeType === 'minibus' ||
          name.toLowerCase().includes('jeep')
        ) {
          mode = 'jeep';
        } else if (
          routeType === 'light_rail' ||
          routeType === 'subway' ||
          routeType === 'rail'
        ) {
          mode = 'rail';
        } else if (routeType === 'ferry') {
          mode = 'ferry';
        }

        const paths: LatLngPoint[][] = [];
        let focusPoint: LatLngPoint | undefined;
        for (const m of el.members ?? []) {
          if (m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length >= 2) {
            const localPts = m.geometry
              .filter((pt) => distanceMetersBetween(center, {lat: pt.lat, lng: pt.lon}) <= 3500)
              .map((pt) => ({lat: pt.lat, lng: pt.lon}));
            if (localPts.length >= 2) {
              paths.push(localPts);
              if (!focusPoint) {
                focusPoint = localPts[Math.floor(localPts.length / 2)];
              }
            }
          }
          if (paths.length >= 16) break;
        }

        routes.push({
          id: `route-${el.id}`,
          ref: tags.ref || (mode === 'jeep' ? 'PUJ' : mode === 'rail' ? 'RAIL' : 'BUS'),
          name,
          mode,
          from: tags.from,
          to: tags.to,
          operator: tags.operator,
          paths,
          focusPoint,
          sourceKind: 'osm-relation',
        });
        continue;
      }

      // Stop-level tagged route_ref or taxi / terminal bays
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      if (tags.amenity === 'taxi') {
        const taxiName = tags.name || tags.operator || 'Taxi Stand / Pick-up Bay';
        const key = `taxi:${taxiName.toLowerCase()}`;
        if (seenKeys[key]) continue;
        seenKeys[key] = true;
        routes.push({
          id: `taxi-${el.type}-${el.id}`,
          ref: 'TAXI',
          name: taxiName,
          mode: 'taxi',
          operator: tags.operator,
          focusPoint: {lat, lng},
          sourceKind: 'osm-taxi-bay',
        });
        continue;
      }

      const rawRefs = tags.route_ref || tags.routes || '';
      if (rawRefs) {
        const stopName = tags.name || tags['addr:street'] || 'Loading Stop';
        for (const token of rawRefs.split(/[;,]/).map((s) => s.trim()).filter(Boolean).slice(0, 4)) {
          const lower = `${token} ${stopName} ${tags.network ?? ''}`.toLowerCase();
          const mode: MappedTransitRoute['mode'] =
            lower.includes('jeep') || lower.includes('puj') || lower.includes('toda')
              ? 'jeep'
              : 'bus';
          const key = `tag:${mode}:${token.toLowerCase()}`;
          if (seenKeys[key]) continue;
          seenKeys[key] = true;
          routes.push({
            id: `stoptag-${el.id}-${token.replace(/[^a-zA-Z0-9]/g, '')}`,
            ref: token.slice(0, 14),
            name: `${token} via ${stopName}`,
            mode,
            operator: tags.operator || tags.network,
            focusPoint: {lat, lng},
            sourceKind: 'osm-stop-tag',
          });
        }
      } else if (tags.amenity === 'bus_station' && tags.name) {
        const lower = tags.name.toLowerCase();
        const mode: MappedTransitRoute['mode'] =
          lower.includes('jeep') || lower.includes('uv') ? 'jeep' : 'bus';
        const key = `station:${tags.name.toLowerCase()}`;
        if (!seenKeys[key]) {
          seenKeys[key] = true;
          routes.push({
            id: `station-${el.type}-${el.id}`,
            ref: mode === 'jeep' ? 'PUJ' : 'BUS',
            name: `${tags.name} Terminal`,
            mode,
            operator: tags.operator,
            focusPoint: {lat, lng},
            sourceKind: 'osm-stop-tag',
          });
        }
      }
    }

    const order: Record<MappedTransitRoute['mode'], number> = {
      jeep: 0,
      bus: 1,
      taxi: 2,
      rail: 3,
      ferry: 4,
    };
    return routes.sort((a, b) => order[a.mode] - order[b.mode]).slice(0, 18);
  } catch {
    return [];
  }
}

const roadPathCache: Record<string, LatLngPoint[]> = {};

/**
 * Fetches and caches a real OSRM driving road path between two points.
 */
export async function fetchOsrmRoadPath(
  origin: LatLngPoint,
  destination: LatLngPoint
): Promise<LatLngPoint[]> {
  const key = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  if (roadPathCache[key]) return roadPathCache[key];

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, {signal: controller.signal});
    window.clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as {
        routes?: Array<{geometry?: {coordinates?: Array<[number, number]>}}>;
      };
      const coords = json.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const pts = coords.map(([lng, lat]) => ({lat, lng}));
        roadPathCache[key] = pts;
        return pts;
      }
    }
  } catch {
    // Fallback below
  }

  return [origin, destination];
}

/**
 * Picks a realistic upstream road origin point for a community sighting and resolves its OSRM road path.
 */
export async function resolveSightingRoadPath(
  sighting: VehicleSightingRecord,
  allZones: LoadingZone[]
): Promise<LatLngPoint[]> {
  const cacheKey = `sight:${sighting.id}`;
  if (roadPathCache[cacheKey]) return roadPathCache[cacheKey];

  const dest: LatLngPoint = {lat: sighting.zoneLat, lng: sighting.zoneLng};
  const neighbor = allZones.find(
    (z) =>
      z.id !== sighting.zoneId &&
      distanceMetersBetween(z.location, dest) >= 400 &&
      distanceMetersBetween(z.location, dest) <= 4000
  );

  const origin: LatLngPoint = neighbor
    ? neighbor.location
    : {
        lat: dest.lat + 0.0085,
        lng: dest.lng - 0.0055,
      };

  const path = await fetchOsrmRoadPath(origin, dest);
  roadPathCache[cacheKey] = path;
  return path;
}

/**
 * Fetches REAL live current weather at the selected Loading Zone using Open-Meteo (free, no key).
 */
export async function fetchZoneWeather(loc: LatLngPoint): Promise<ZoneWeatherInfo | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat.toFixed(4)}&longitude=${loc.lng.toFixed(4)}&current=temperature_2m,precipitation,weather_code`;
    const res = await fetch(url, {signal: controller.signal});
    window.clearTimeout(timer);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        precipitation?: number;
        weather_code?: number;
      };
    };
    const cur = json.current;
    if (!cur || typeof cur.temperature_2m !== 'number') return null;

    const code = Number(cur.weather_code ?? 0);
    const precip = Number(cur.precipitation ?? 0);
    const isRainy = precip > 0.1 || (code >= 51 && code <= 99);

    return {
      temperatureC: Math.round(cur.temperature_2m),
      precipitationMm: Number(precip.toFixed(1)),
      weatherCode: code,
      isRainy,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches REAL walking distance, walking time, and path from user GPS to selected Loading Zone via OSRM.
 */
export async function fetchWalkingRouteSummary(
  origin: LatLngPoint,
  destination: LatLngPoint
): Promise<{distanceMeters: number; durationSeconds: number; path: LatLngPoint[]} | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const url = `https://router.project-osrm.org/route/v1/foot/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, {signal: controller.signal});
    window.clearTimeout(timer);
    if (!res.ok) return null;

    const json = (await res.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: {coordinates?: Array<[number, number]>};
      }>;
    };
    const route = json.routes?.[0];
    if (!route?.geometry?.coordinates || route.geometry.coordinates.length < 2) return null;

    return {
      distanceMeters: Math.round(route.distance ?? distanceMetersBetween(origin, destination)),
      durationSeconds: Math.round(route.duration ?? 60),
      path: route.geometry.coordinates.map(([lng, lat]) => ({lat, lng})),
    };
  } catch {
    return null;
  }
}

/**
 * Combines ONLY genuine real-time GPS trips and live community sightings
 * approaching or broadcasting near the selected Loading Zone.
 * Sightings move in real time along their cached OSRM road path.
 */
export function computeLiveVehiclesForZone(
  liveTrips: LiveGpsTripRecord[],
  sightings: VehicleSightingRecord[],
  targetZone: LoadingZone | null,
  currentUid: string | null,
  sightingPaths: Record<string, LatLngPoint[]> = {},
  fallbackCenter: LatLngPoint = {lat: 14.5995, lng: 120.9842}
): TrackedVehicle[] {
  const result: TrackedVehicle[] = [];
  const targetLocation = targetZone?.location ?? fallbackCenter;
  const targetId = targetZone?.id ?? 'area-center';
  const zoneShort = targetZone
    ? targetZone.name.split('—')[0].trim().slice(0, 24)
    : 'Nearby Area';
  const now = Date.now();

  // 1. Live driver/passenger GPS trips within 25 km of the selected zone or map center
  for (const trip of liveTrips) {
    const tripPos: LatLngPoint = {lat: trip.lat, lng: trip.lng};
    const dist = Math.round(distanceMetersBetween(tripPos, targetLocation));
    if (dist > 25000) continue;

    const effectiveSpeed = Math.max(4.5, trip.speedMps > 0.8 ? trip.speedMps : 6.2);
    const etaSeconds = Math.max(20, Math.round(dist / effectiveSpeed));
    const heading =
      trip.heading > 0 ? trip.heading : bearingDegrees(tripPos, targetLocation);
    const freshnessSec = Math.max(0, Math.round((now - trip.updatedAtMs) / 1000));
    const speedKmh = Math.round(trip.speedMps * 3.6);

    result.push({
      id: `gps-${trip.tripId}`,
      type: trip.type,
      routeCode: 'LIVE GPS',
      routeLabel: trip.routeLabel,
      destination: zoneShort,
      plateNumber: trip.displayName,
      occupancy: trip.occupancy,
      fareText: trip.type === 'taxi' ? '₱45 flagdown' : '₱13.00 min',
      path: [tripPos, targetLocation],
      progress: 0,
      speedMps: effectiveSpeed,
      totalMeters: dist,
      distanceMeters: dist,
      etaSeconds,
      position: tripPos,
      heading,
      targetZoneId: targetId,
      liveMode: 'gps',
      reporterName: trip.displayName,
      reportedAtMs: trip.updatedAtMs,
      freshnessSec,
      speedKmh,
      isSelf: Boolean(currentUid && trip.driverUid === currentUid),
    });
  }

  // 2. Real community sightings moving smoothly along real OSRM roads toward the stop
  for (const sight of sightings) {
    if (sight.expiresAtMs <= now) continue;
    const sightZonePos: LatLngPoint = {lat: sight.zoneLat, lng: sight.zoneLng};
    const isSameZone = Boolean(targetZone && sight.zoneId === targetZone.id);
    const nearTarget = distanceMetersBetween(sightZonePos, targetLocation) <= 2000;
    if (!isSameZone && !nearTarget) continue;

    const totalApproachSec = Math.max(60, sight.etaMinutes * 60);
    const elapsedSec = Math.max(0, Math.round((now - sight.createdAtMs) / 1000));
    const remainingSec = Math.max(15, totalApproachSec - elapsedSec);
    const progress = Math.max(0.05, Math.min(0.98, elapsedSec / totalApproachSec));

    const fallbackPath: LatLngPoint[] = [
      {lat: targetLocation.lat + 0.0085, lng: targetLocation.lng - 0.0055},
      targetLocation,
    ];
    const path = sightingPaths[sight.id] ?? fallbackPath;
    const interp = interpolateAlongPath(path, progress);
    const estMeters = Math.max(25, Math.round(interp.totalMeters * (1 - progress)));
    const freshnessSec = elapsedSec;

    result.push({
      id: `sight-${sight.id}`,
      type: sight.type,
      routeCode: 'SPOTTED',
      routeLabel: sight.routeLabel,
      destination: sight.zoneName.split('—')[0].trim().slice(0, 24),
      plateNumber: sight.reporterName,
      occupancy: sight.occupancy,
      fareText: sight.type === 'taxi' ? '₱45 flagdown' : '₱13.00 min',
      path,
      progress,
      speedMps: Math.max(3, Math.round(interp.totalMeters / totalApproachSec)),
      totalMeters: interp.totalMeters,
      distanceMeters: estMeters,
      etaSeconds: remainingSec,
      position: interp.position,
      heading: interp.heading,
      targetZoneId: targetId,
      liveMode: 'community',
      reporterName: sight.reporterName,
      reportedAtMs: sight.createdAtMs,
      freshnessSec,
    });
  }

  return result.sort((a, b) => a.etaSeconds - b.etaSeconds);
}
