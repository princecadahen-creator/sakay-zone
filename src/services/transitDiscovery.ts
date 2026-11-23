import type {LatLngPoint, LoadingZone, TrackedVehicle, VehicleType, ZoneRuleType} from '../types/transit';

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
 * Computes total path length in meters and interpolates a point + heading at normalized t in [0, 1].
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
 * using the 100% free OpenStreetMap Overpass API, with a road-snapped OSRM fallback
 * so quiet provincial areas still show usable loading/unloading points.
 */
export async function discoverNearbyLoadingZones(
  center: LatLngPoint,
  areaLabel?: string
): Promise<LoadingZone[]> {
  const zonesById: Record<string, LoadingZone> = {};

  const query = `
    [out:json][timeout:6];
    (
      node["highway"="bus_stop"](around:1500,${center.lat},${center.lng});
      node["amenity"="bus_station"](around:1500,${center.lat},${center.lng});
      way["amenity"="bus_station"](around:1500,${center.lat},${center.lng});
      node["amenity"="taxi"](around:1500,${center.lat},${center.lng});
      node["public_transport"="platform"](around:1500,${center.lat},${center.lng});
      node["railway"~"station|halt"](around:1500,${center.lat},${center.lng});
    );
    out center 12;
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
          landmarkTip: `Located near ${street}. Stand safely behind the curb and check vehicle signboards before boarding.`,
          fareRange: allowedVehicles.includes('bus') ? '₱13 – ₱35' : '₱13 – ₱20',
        };
      }
    }
  } catch {
    // Gracefully fall through to OSRM road-snapped stops if Overpass times out
  }

  // If Overpass returned fewer than 2 stops (common in smaller towns/barangays),
  // snap up to 3 realistic roadside loading/unloading points to actual streets via free OSRM Nearest API
  if (Object.keys(zonesById).length < 2) {
    const candidateOffsets: Array<{offset: LatLngPoint; suffix: string; vehicles: VehicleType[]}> = [
      {
        offset: {lat: center.lat, lng: center.lng},
        suffix: 'Main Loading / Unloading Bay',
        vehicles: ['jeep', 'bus', 'taxi'],
      },
      {
        offset: {lat: center.lat + 0.0032, lng: center.lng + 0.0022},
        suffix: 'Northbound Sakayan / Stop',
        vehicles: ['jeep', 'taxi'],
      },
      {
        offset: {lat: center.lat - 0.003, lng: center.lng - 0.0024},
        suffix: 'Southbound Highway Stop',
        vehicles: ['jeep', 'bus', 'taxi'],
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
        const zone: LoadingZone = {
          id: `road-${idx}-${finalLoc.lat.toFixed(4)}-${finalLoc.lng.toFixed(4)}`,
          name: `${labelBase} — ${item.suffix}`,
          address: streetName,
          location: finalLoc,
          source: 'places',
          allowedVehicles: item.vehicles,
          ruleType: 'loading_unloading',
          status: 'active',
          landmarkTip: `Roadside loading/unloading point along ${streetName}. You can also pin exact local stops under Manage Stops.`,
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
 * Fetches a real driving road path using free OSRM routing.
 */
async function fetchOsrmRoadPath(
  origin: LatLngPoint,
  destination: LatLngPoint
): Promise<LatLngPoint[]> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, {signal: controller.signal});
    window.clearTimeout(timer);

    if (res.ok) {
      const json = (await res.json()) as {
        routes?: Array<{geometry?: {coordinates?: Array<[number, number]>}}>;
      };
      const coords = json.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        return coords.map(([lng, lat]) => ({lat, lng}));
      }
    }
  } catch {
    // Fallback below
  }
  return [origin, destination];
}

/**
 * Builds approaching Jeepney, Bus, and Taxi units along real OSRM road corridors
 * heading into the selected LoadingZone.
 */
export async function buildApproachingFleetForZone(
  targetZone: LoadingZone,
  allZones: LoadingZone[]
): Promise<TrackedVehicle[]> {
  const otherZones = allZones.filter((z) => z.id !== targetZone.id && !z.hidden);

  const fallbackOffsets: LatLngPoint[] = [
    {lat: targetZone.location.lat + 0.0085, lng: targetZone.location.lng - 0.0065},
    {lat: targetZone.location.lat - 0.0095, lng: targetZone.location.lng - 0.0045},
    {lat: targetZone.location.lat + 0.0055, lng: targetZone.location.lng + 0.0095},
  ];

  const approachOrigins: Array<{origin: LatLngPoint; label: string}> = [];
  for (let i = 0; i < 3; i++) {
    const neighbor = otherZones[i];
    if (neighbor && distanceMetersBetween(neighbor.location, targetZone.location) > 250) {
      approachOrigins.push({
        origin: neighbor.location,
        label: neighbor.name.split('—')[0].trim().slice(0, 24),
      });
    } else {
      approachOrigins.push({
        origin: fallbackOffsets[i],
        label: i === 0 ? 'North Approach' : i === 1 ? 'South Approach' : 'East Approach',
      });
    }
  }

  const computedPaths = await Promise.all(
    approachOrigins.map((item) => fetchOsrmRoadPath(item.origin, targetZone.location))
  );

  const zoneShort = targetZone.name.split('—')[0].trim().slice(0, 24);
  const templates: Array<{
    type: VehicleType;
    routeCode: string;
    routeLabel: string;
    plateNumber: string;
    occupancy: 'seats' | 'standing' | 'full';
    fareText: string;
    initialProgress: number;
    speedMps: number;
    pathIdx: number;
  }> = [
    {
      type: 'jeep',
      routeCode: 'J-14',
      routeLabel: `${approachOrigins[0].label} → ${zoneShort}`,
      plateNumber: 'PYJ 482',
      occupancy: 'seats',
      fareText: '₱13.00 min',
      initialProgress: 0.72,
      speedMps: 6.8,
      pathIdx: 0,
    },
    {
      type: 'jeep',
      routeCode: 'J-08',
      routeLabel: `${approachOrigins[1].label} → ${zoneShort}`,
      plateNumber: 'NVA 915',
      occupancy: 'standing',
      fareText: '₱13.00 min',
      initialProgress: 0.38,
      speedMps: 6.4,
      pathIdx: 1,
    },
    {
      type: 'bus',
      routeCode: 'B-22',
      routeLabel: `Highway Loop → ${zoneShort}`,
      plateNumber: 'BHS 704',
      occupancy: 'seats',
      fareText: '₱15.00 min',
      initialProgress: 0.56,
      speedMps: 7.4,
      pathIdx: 2,
    },
    {
      type: 'bus',
      routeCode: 'B-05',
      routeLabel: `${approachOrigins[1].label} → ${zoneShort}`,
      plateNumber: 'EAB 331',
      occupancy: 'full',
      fareText: '₱15.00 min',
      initialProgress: 0.22,
      speedMps: 7.1,
      pathIdx: 1,
    },
    {
      type: 'taxi',
      routeCode: 'TX-1',
      routeLabel: `Metered Taxi · ${approachOrigins[2].label}`,
      plateNumber: 'TXN 619',
      occupancy: 'seats',
      fareText: '₱45 flagdown',
      initialProgress: 0.81,
      speedMps: 9.2,
      pathIdx: 2,
    },
    {
      type: 'taxi',
      routeCode: 'TX-4',
      routeLabel: `Metered Taxi · ${approachOrigins[0].label}`,
      plateNumber: 'UVT 208',
      occupancy: 'seats',
      fareText: '₱45 flagdown',
      initialProgress: 0.46,
      speedMps: 8.6,
      pathIdx: 0,
    },
  ];

  return templates.map((tpl, idx) => {
    const path = computedPaths[tpl.pathIdx] ?? [fallbackOffsets[0], targetZone.location];
    const interp = interpolateAlongPath(path, tpl.initialProgress);
    const remainingMeters = Math.max(20, Math.round(interp.totalMeters * (1 - tpl.initialProgress)));
    const etaSeconds = Math.max(15, Math.round(remainingMeters / tpl.speedMps));

    return {
      id: `${targetZone.id}-veh-${idx}`,
      type: tpl.type,
      routeCode: tpl.routeCode,
      routeLabel: tpl.routeLabel,
      destination: zoneShort,
      plateNumber: tpl.plateNumber,
      occupancy: tpl.occupancy,
      fareText: tpl.fareText,
      path,
      progress: tpl.initialProgress,
      speedMps: tpl.speedMps,
      totalMeters: interp.totalMeters,
      distanceMeters: remainingMeters,
      etaSeconds,
      position: interp.position,
      heading: interp.heading,
      targetZoneId: targetZone.id,
    };
  });
}
