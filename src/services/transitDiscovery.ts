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

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {lat: number; lon: number};
  tags?: Record<string, string>;
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
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as {elements?: OverpassElement[]};
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

        zonesById[id] = {
          id,
          name,
          address: street,
          location: {lat, lng},
          source: 'places',
          allowedVehicles,
          ruleType: inferRuleFromName(name),
          status: 'active',
          landmarkTip: `OpenStreetMap transit stop near ${street}. Stand safely behind the curb and verify the vehicle signboard before boarding.`,
          fareRange: allowedVehicles.includes('bus') ? '₱13 – ₱35' : '₱13 – ₱20',
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
 * Discovers REAL mapped public transit routes (jeepney/share_taxi, bus, rail, ferry)
 * passing near the searched location via OpenStreetMap Overpass API.
 */
export async function discoverMappedRoutesNear(
  center: LatLngPoint
): Promise<MappedTransitRoute[]> {
  const query = `
    [out:json][timeout:6];
    relation["route"~"bus|share_taxi|minibus|light_rail|subway|rail|ferry"](around:1200,${center.lat},${center.lng});
    out tags 18;
  `;

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'},
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    if (!res.ok) return [];
    const data = (await res.json()) as {elements?: OverpassElement[]};
    const seenNames: Record<string, boolean> = {};
    const routes: MappedTransitRoute[] = [];

    for (const el of data.elements ?? []) {
      const tags = el.tags ?? {};
      const routeType = tags.route ?? 'bus';
      const name = tags.name || `${tags.from ?? 'Origin'} → ${tags.to ?? 'Destination'}`;
      if (!name || seenNames[name]) continue;
      seenNames[name] = true;

      let mode: MappedTransitRoute['mode'] = 'bus';
      if (routeType === 'share_taxi' || routeType === 'minibus' || name.toLowerCase().includes('jeep')) {
        mode = 'jeep';
      } else if (routeType === 'light_rail' || routeType === 'subway' || routeType === 'rail') {
        mode = 'rail';
      } else if (routeType === 'ferry') {
        mode = 'ferry';
      }

      routes.push({
        id: `route-${el.id}`,
        ref: tags.ref || (mode === 'jeep' ? 'PUJ' : mode === 'rail' ? 'RAIL' : 'BUS'),
        name,
        mode,
        from: tags.from,
        to: tags.to,
        operator: tags.operator,
      });
    }

    return routes.slice(0, 12);
  } catch {
    return [];
  }
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
 * approaching or reported near the selected Loading Zone. Zero fake/demo units.
 */
export function computeLiveVehiclesForZone(
  liveTrips: LiveGpsTripRecord[],
  sightings: VehicleSightingRecord[],
  targetZone: LoadingZone,
  currentUid: string | null
): TrackedVehicle[] {
  const result: TrackedVehicle[] = [];
  const zoneShort = targetZone.name.split('—')[0].trim().slice(0, 24);
  const now = Date.now();

  // 1. Live driver/passenger GPS trips within 18 km of the selected zone
  for (const trip of liveTrips) {
    const tripPos: LatLngPoint = {lat: trip.lat, lng: trip.lng};
    const dist = Math.round(distanceMetersBetween(tripPos, targetZone.location));
    if (dist > 18000) continue;

    const effectiveSpeed = Math.max(4.5, trip.speedMps > 0.8 ? trip.speedMps : 6.2);
    const etaSeconds = Math.max(20, Math.round(dist / effectiveSpeed));
    const heading =
      trip.heading > 0 ? trip.heading : bearingDegrees(tripPos, targetZone.location);

    result.push({
      id: `gps-${trip.tripId}`,
      type: trip.type,
      routeCode: 'LIVE GPS',
      routeLabel: trip.routeLabel,
      destination: zoneShort,
      plateNumber: trip.displayName,
      occupancy: trip.occupancy,
      fareText: trip.type === 'taxi' ? '₱45 flagdown' : '₱13.00 min',
      path: [tripPos, targetZone.location],
      progress: 0,
      speedMps: effectiveSpeed,
      totalMeters: dist,
      distanceMeters: dist,
      etaSeconds,
      position: tripPos,
      heading,
      targetZoneId: targetZone.id,
      liveMode: 'gps',
      reporterName: trip.displayName,
      reportedAtMs: trip.updatedAtMs,
      isSelf: Boolean(currentUid && trip.driverUid === currentUid),
    });
  }

  // 2. Real community sightings matching this zone (or within 600m) and not expired
  for (const sight of sightings) {
    if (sight.expiresAtMs <= now) continue;
    const sightZonePos: LatLngPoint = {lat: sight.zoneLat, lng: sight.zoneLng};
    const isSameZone = sight.zoneId === targetZone.id;
    const nearTarget = distanceMetersBetween(sightZonePos, targetZone.location) <= 600;
    if (!isSameZone && !nearTarget) continue;

    const elapsedSec = Math.max(0, Math.round((now - sight.createdAtMs) / 1000));
    const remainingSec = Math.max(30, sight.etaMinutes * 60 - elapsedSec);
    const estMeters = Math.max(60, Math.round(remainingSec * 6.0));
    const markerPos: LatLngPoint = {
      lat: targetZone.location.lat + 0.0018,
      lng: targetZone.location.lng - 0.0015,
    };

    result.push({
      id: `sight-${sight.id}`,
      type: sight.type,
      routeCode: 'SPOTTED',
      routeLabel: sight.routeLabel,
      destination: sight.zoneName.split('—')[0].trim().slice(0, 24),
      plateNumber: sight.reporterName,
      occupancy: sight.occupancy,
      fareText: sight.type === 'taxi' ? '₱45 flagdown' : '₱13.00 min',
      path: [markerPos, targetZone.location],
      progress: 0,
      speedMps: 6.0,
      totalMeters: estMeters,
      distanceMeters: estMeters,
      etaSeconds: remainingSec,
      position: markerPos,
      heading: bearingDegrees(markerPos, targetZone.location),
      targetZoneId: targetZone.id,
      liveMode: 'community',
      reporterName: sight.reporterName,
      reportedAtMs: sight.createdAtMs,
    });
  }

  return result.sort((a, b) => a.etaSeconds - b.etaSeconds);
}
