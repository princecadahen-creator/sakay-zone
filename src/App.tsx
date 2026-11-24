import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {onAuthStateChanged, type User} from 'firebase/auth';
import {
  Bus,
  BusFront,
  CarTaxiFront,
  Check,
  Download,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  MapPinPlus,
  Radio,
  Square,
  Video,
  X,
} from 'lucide-react';
import {auth, signInWithGoogle, signOutAccount} from './firebase';
import {AreaSearchBar} from './components/AreaSearchBar';
import {ArrivalsBoard} from './components/ArrivalsBoard';
import {ManageZonesPanel} from './components/ManageZonesPanel';
import {NewcomerGuide} from './components/NewcomerGuide';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PWAInstallButton} from './components/PWAInstallButton';
import {TikTokShareModal} from './components/TikTokShareModal';
import {TransitMapView} from './components/TransitMapView';
import {TRANSLATIONS} from './i18n/translations';
import {
  createCommunityZone,
  deleteCommunityZone,
  postVehicleSighting,
  removeWaitingCheckin,
  reportZoneStatus,
  stopLiveGpsTrip,
  subscribeCommunityZones,
  subscribeLiveGpsTrips,
  subscribeVehicleSightings,
  subscribeWaitingCheckins,
  subscribeZoneStatusReports,
  updateCommunityZone,
  upsertLiveGpsTrip,
  upsertWaitingCheckin,
} from './services/liveTransitSync';
import {
  computeLiveVehiclesForZone,
  discoverMappedRoutesNear,
  discoverNearbyLoadingZones,
  distanceMetersBetween,
  fetchWalkingRouteSummary,
  fetchZoneWeather,
  resolveSightingRoadPath,
} from './services/transitDiscovery';
import type {
  CommunityZoneRecord,
  Language,
  LatLngPoint,
  LiveGpsTripRecord,
  LoadingZone,
  MappedTransitRoute,
  VehicleSightingRecord,
  VehicleType,
  WaitingCheckinRecord,
  ZoneStatus,
  ZoneStatusReportRecord,
  ZoneWeatherInfo,
} from './types/transit';

const DEFAULT_CENTER: LatLngPoint = {lat: 14.5995, lng: 120.9842};
const LOCAL_HIDE_STORAGE_KEY = 'sakayzone_hidden_ids_v2';
const OFFLINE_AREAS_STORAGE_KEY = 'sakayzone_offline_areas_v1';

interface SavedOfflineArea {
  key: string;
  label: string;
  center: LatLngPoint;
  zones: LoadingZone[];
  routes: MappedTransitRoute[];
  savedAtMs: number;
}

function loadHiddenZoneIds(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LOCAL_HIDE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function loadSavedOfflineAreas(): SavedOfflineArea[] {
  try {
    const raw = localStorage.getItem(OFFLINE_AREAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedOfflineArea =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as SavedOfflineArea).key === 'string' &&
        Array.isArray((item as SavedOfflineArea).zones)
    );
  } catch {
    return [];
  }
}

function persistSavedOfflineAreas(areas: SavedOfflineArea[]): void {
  try {
    const compact = areas.slice(0, 8).map((area) => ({
      ...area,
      zones: area.zones.slice(0, 20),
      routes: area.routes.slice(0, 10).map((rt) => ({
        ...rt,
        paths: rt.paths ? rt.paths.slice(0, 6).map((seg) => seg.slice(0, 35)) : undefined,
      })),
    }));
    localStorage.setItem(OFFLINE_AREAS_STORAGE_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function latLngToOsmTile(lat: number, lng: number, zoom: number): {x: number; y: number} {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return {x, y};
}

async function preloadOsmTilesAround(center: LatLngPoint): Promise<number> {
  const urls: string[] = [];
  const subs = ['a', 'b', 'c'];
  let idx = 0;

  for (const zoom of [14, 15]) {
    const base = latLngToOsmTile(center.lat, center.lng, zoom);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const sub = subs[idx % subs.length];
        idx++;
        urls.push(`https://${sub}.tile.openstreetmap.org/${zoom}/${base.x + dx}/${base.y + dy}.png`);
      }
    }
  }

  let cached = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {mode: 'cors'});
        if (res.ok) cached++;
      } catch {
        // Ignore individual tile fetch errors
      }
    })
  );
  return cached;
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('sakayzone_lang_v1');
      return saved === 'fil' ? 'fil' : 'en';
    } catch {
      return 'en';
    }
  });
  const copy = TRANSLATIONS[language];

  useEffect(() => {
    try {
      localStorage.setItem('sakayzone_lang_v1', language);
    } catch {
      // Ignore storage errors
    }
  }, [language]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<LatLngPoint>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [areaLabel, setAreaLabel] = useState<string>('Metro Manila');
  const [userLocation, setUserLocation] = useState<LatLngPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Real OpenStreetMap stops & routes + live Open-Meteo weather
  const [osmZones, setOsmZones] = useState<LoadingZone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(true);
  const [mappedRoutes, setMappedRoutes] = useState<MappedTransitRoute[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [zoneWeather, setZoneWeather] = useState<ZoneWeatherInfo | null>(null);
  const [walkingInfo, setWalkingInfo] = useState<{
    distanceMeters: number;
    durationSeconds: number;
    path: LatLngPoint[];
  } | null>(null);

  // Real Firestore live community collections
  const [communityZones, setCommunityZones] = useState<CommunityZoneRecord[]>([]);
  const [statusReports, setStatusReports] = useState<Record<string, ZoneStatusReportRecord>>({});
  const [sightings, setSightings] = useState<VehicleSightingRecord[]>([]);
  const [liveTrips, setLiveTrips] = useState<LiveGpsTripRecord[]>([]);
  const [waitingCheckins, setWaitingCheckins] = useState<WaitingCheckinRecord[]>([]);

  const [hiddenZoneIds, setHiddenZoneIds] = useState<Record<string, boolean>>(loadHiddenZoneIds);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<'all' | VehicleType>('all');
  const [isPinMode, setIsPinMode] = useState(false);
  const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);

  // Driver / Passenger Live GPS Broadcast state
  const [shareSetupOpen, setShareSetupOpen] = useState(false);
  const [shareType, setShareType] = useState<VehicleType>('jeep');
  const [shareRoute, setShareRoute] = useState('');
  const [shareOccupancy, setShareOccupancy] = useState<'seats' | 'standing' | 'full'>('seats');
  const [isBroadcastingGps, setIsBroadcastingGps] = useState(false);
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsWriteAtRef = useRef<number>(0);
  const firstGpsWriteRef = useRef<boolean>(true);

  const [savedOfflineAreas, setSavedOfflineAreas] = useState<SavedOfflineArea[]>(
    loadSavedOfflineAreas
  );
  const [sightingPaths, setSightingPaths] = useState<Record<string, LatLngPoint[]>>({});
  const [isCachingOffline, setIsCachingOffline] = useState(false);
  const [offlineCacheDoneKey, setOfflineCacheDoneKey] = useState<string | null>(null);

  const areaCacheRef = useRef<Record<string, LoadingZone[]>>({});
  const routesCacheRef = useRef<Record<string, MappedTransitRoute[]>>({});

  // Seed in-memory caches from localStorage on initial render so zero-data cold starts work immediately
  useEffect(() => {
    for (const area of savedOfflineAreas) {
      if (!areaCacheRef.current[area.key]) {
        areaCacheRef.current[area.key] = area.zones;
      }
      if (!routesCacheRef.current[area.key]) {
        routesCacheRef.current[area.key] = area.routes;
      }
    }
  }, [savedOfflineAreas]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setAuthNotice(null);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time listeners (public live transit state)
  useEffect(() => {
    const onSyncErr = (err: Error) => {
      console.error('Live sync error:', err.message);
    };
    const u1 = subscribeCommunityZones(setCommunityZones, onSyncErr);
    const u2 = subscribeZoneStatusReports(setStatusReports, onSyncErr);
    const u3 = subscribeVehicleSightings(setSightings, onSyncErr);
    const u4 = subscribeLiveGpsTrips(setLiveTrips, onSyncErr);
    const u5 = subscribeWaitingCheckins(setWaitingCheckins, onSyncErr);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  // Live 1-second countdown tick while vehicles are active; 30s sweep otherwise
  const [clockTick, setClockTick] = useState(0);
  const hasActiveFeed = sightings.length > 0 || liveTrips.length > 0;
  useEffect(() => {
    const intervalMs = hasActiveFeed ? 1000 : 30000;
    const id = window.setInterval(() => setClockTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [hasActiveFeed]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_HIDE_STORAGE_KEY, JSON.stringify(hiddenZoneIds));
    } catch {
      // Ignore storage errors
    }
  }, [hiddenZoneIds]);

  // Merge OpenStreetMap zones + nearby Firestore community zones + live status reports
  const allZones = useMemo(() => {
    const mergedMap: Record<string, LoadingZone> = {};

    for (const z of osmZones) {
      const liveReport = statusReports[z.id];
      mergedMap[z.id] = {
        ...z,
        status: liveReport?.status ?? z.status,
        queueNote: liveReport?.queueNote,
        statusUpdatedAtMs: liveReport?.updatedAtMs,
        statusReporterName: liveReport?.reporterName,
        hidden: Boolean(hiddenZoneIds[z.id]),
      };
    }

    for (const cz of communityZones) {
      const dist = distanceMetersBetween(mapCenter, {lat: cz.lat, lng: cz.lng});
      if (dist > 8000 && cz.id !== selectedZoneId) continue;
      const liveReport = statusReports[cz.id];
      mergedMap[cz.id] = {
        id: cz.id,
        name: cz.name,
        address: cz.address,
        location: {lat: cz.lat, lng: cz.lng},
        source: 'custom',
        allowedVehicles: cz.allowedVehicles,
        ruleType: cz.ruleType,
        status: liveReport?.status ?? cz.status,
        landmarkTip: cz.landmarkTip,
        fareRange: cz.fareRange,
        authorUid: cz.authorUid,
        authorName: cz.authorName,
        queueNote: liveReport?.queueNote,
        statusUpdatedAtMs: liveReport?.updatedAtMs,
        statusReporterName: liveReport?.reporterName,
        hidden: Boolean(hiddenZoneIds[cz.id]),
      };
    }

    return Object.values(mergedMap).sort(
      (a, b) =>
        distanceMetersBetween(mapCenter, a.location) -
        distanceMetersBetween(mapCenter, b.location)
    );
  }, [osmZones, communityZones, statusReports, hiddenZoneIds, mapCenter, selectedZoneId]);

  const visibleZones = useMemo(() => allZones.filter((z) => !z.hidden), [allZones]);

  const selectedZone = useMemo(
    () => allZones.find((z) => z.id === selectedZoneId) ?? visibleZones[0] ?? null,
    [allZones, visibleZones, selectedZoneId]
  );

  // Waiting check-in counts per zone
  const waitingCountsByZone = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const wc of waitingCheckins) {
      counts[wc.zoneId] = (counts[wc.zoneId] ?? 0) + 1;
    }
    return counts;
  }, [waitingCheckins]);

  const selectedZoneWaitingCount = selectedZone
    ? waitingCountsByZone[selectedZone.id] ?? 0
    : 0;

  const isUserWaitingAtSelectedZone = Boolean(
    currentUser &&
      selectedZone &&
      waitingCheckins.some(
        (wc) => wc.userUid === currentUser.uid && wc.zoneId === selectedZone.id
      )
  );

  // Load real OSM stops & real OSM mapped routes for searched area (with zero-data offline fallback)
  const loadAreaData = useCallback(async (targetCenter: LatLngPoint, label?: string) => {
    const cacheKey = `${targetCenter.lat.toFixed(3)},${targetCenter.lng.toFixed(3)}`;
    const areaName = (label || 'Saved Area').trim();

    let resolvedZones: LoadingZone[] = areaCacheRef.current[cacheKey] ?? [];
    if (resolvedZones.length > 0) {
      setOsmZones(resolvedZones);
      setIsLoadingZones(false);
      if (resolvedZones[0]) setSelectedZoneId(resolvedZones[0].id);
    } else {
      setIsLoadingZones(true);
      resolvedZones = await discoverNearbyLoadingZones(targetCenter, areaName);
      if (resolvedZones.length === 0) {
        const offlineMatch = loadSavedOfflineAreas().find(
          (a) => a.key === cacheKey || distanceMetersBetween(a.center, targetCenter) <= 2500
        );
        if (offlineMatch) {
          resolvedZones = offlineMatch.zones;
        }
      }
      if (resolvedZones.length > 0) {
        areaCacheRef.current[cacheKey] = resolvedZones;
      }
      setOsmZones(resolvedZones);
      setIsLoadingZones(false);
      if (resolvedZones[0]) setSelectedZoneId(resolvedZones[0].id);
    }

    let resolvedRoutes: MappedTransitRoute[] = routesCacheRef.current[cacheKey] ?? [];
    if (resolvedRoutes.length > 0) {
      setMappedRoutes(resolvedRoutes);
      setIsLoadingRoutes(false);
    } else {
      setIsLoadingRoutes(true);
      resolvedRoutes = await discoverMappedRoutesNear(targetCenter);
      if (resolvedRoutes.length === 0 && !navigator.onLine) {
        const offlineMatch = loadSavedOfflineAreas().find(
          (a) => a.key === cacheKey || distanceMetersBetween(a.center, targetCenter) <= 2500
        );
        if (offlineMatch) {
          resolvedRoutes = offlineMatch.routes;
        }
      }
      if (resolvedRoutes.length > 0) {
        routesCacheRef.current[cacheKey] = resolvedRoutes;
      }
      setMappedRoutes(resolvedRoutes);
      setIsLoadingRoutes(false);
    }

    if (resolvedZones.length > 0 && navigator.onLine) {
      setSavedOfflineAreas((prev) => {
        const nextEntry: SavedOfflineArea = {
          key: cacheKey,
          label: areaName.split(',')[0].trim().slice(0, 32) || 'Saved Area',
          center: targetCenter,
          zones: resolvedZones,
          routes: resolvedRoutes,
          savedAtMs: Date.now(),
        };
        const filtered = prev.filter((item) => item.key !== cacheKey);
        const updated = [nextEntry, ...filtered].slice(0, 8);
        persistSavedOfflineAreas(updated);
        return updated;
      });
    }
  }, []);

  useEffect(() => {
    void loadAreaData(DEFAULT_CENTER, 'Metro Manila');
  }, [loadAreaData]);

  // Fetch real weather for selected Loading Zone
  useEffect(() => {
    if (!selectedZone) {
      setZoneWeather(null);
      return;
    }
    let cancelled = false;
    void fetchZoneWeather(selectedZone.location).then((w) => {
      if (!cancelled) setZoneWeather(w);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedZone?.id]);

  // Fetch real walking route from user's GPS to selected Loading Zone
  useEffect(() => {
    if (!userLocation || !selectedZone) {
      setWalkingInfo(null);
      return;
    }
    const straightDist = distanceMetersBetween(userLocation, selectedZone.location);
    if (straightDist > 15000) {
      setWalkingInfo(null);
      return;
    }
    let cancelled = false;
    void fetchWalkingRouteSummary(userLocation, selectedZone.location).then((res) => {
      if (!cancelled) setWalkingInfo(res);
    });
    return () => {
      cancelled = true;
    };
  }, [userLocation, selectedZone?.id]);

  // Resolve real OSRM street geometry for community sightings so vehicles follow real roads
  useEffect(() => {
    const now = Date.now();
    const missing = sightings.filter((s) => s.expiresAtMs > now && !sightingPaths[s.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (sight) => {
        const path = await resolveSightingRoadPath(sight, allZones);
        return {id: sight.id, path};
      })
    ).then((resolved) => {
      if (cancelled) return;
      setSightingPaths((prev) => {
        const next = {...prev};
        for (const item of resolved) {
          next[item.id] = item.path;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [sightings, allZones, sightingPaths]);

  // Real live vehicles (ONLY live GPS trips + road-tracked community sightings)
  const liveVehicles = useMemo(() => {
    void clockTick;
    return computeLiveVehiclesForZone(
      liveTrips,
      sightings,
      selectedZone,
      currentUser?.uid ?? null,
      sightingPaths,
      mapCenter
    );
  }, [liveTrips, sightings, selectedZone, currentUser?.uid, sightingPaths, mapCenter, clockTick]);

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'all') return liveVehicles;
    return liveVehicles.filter((v) => v.type === vehicleFilter);
  }, [liveVehicles, vehicleFilter]);

  const handleSignIn = useCallback(async () => {
    try {
      await signInWithGoogle();
      setAuthNotice(null);
    } catch (error) {
      setAuthNotice(
        error instanceof Error
          ? error.message
          : 'Sign-in cancelled or popup blocked. Allow popups and try again.'
      );
    }
  }, []);

  const handleAreaSelected = useCallback(
    (loc: LatLngPoint, label: string) => {
      setAreaLabel(label);
      setMapCenter(loc);
      setMapZoom(15);
      setSelectedVehicleId(null);
      void loadAreaData(loc, label);
    },
    [loadAreaData]
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setAuthNotice('GPS is not supported in this browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(nextLoc);
        setAreaLabel('Current Location');
        setMapCenter(nextLoc);
        setMapZoom(16);
        setIsLocating(false);
        void loadAreaData(nextLoc, 'Current Location');
      },
      () => {
        setIsLocating(false);
        setAuthNotice('Unable to access GPS. Enable location permission to locate nearby stops.');
      },
      {enableHighAccuracy: true, timeout: 8000}
    );
  }, [loadAreaData]);

  // Real GPS Watch Loop for Driver / Commuter Live Broadcast
  const stopBroadcast = useCallback(async () => {
    if (gpsWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setIsBroadcastingGps(false);
    await stopLiveGpsTrip();
  }, []);

  useEffect(() => {
    return () => {
      if (gpsWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
    };
  }, []);

  const startBroadcast = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser) {
        setAuthNotice(copy.signInToContribute);
        return;
      }
      if (!navigator.geolocation) {
        setAuthNotice('GPS is not available on this device.');
        return;
      }

      const routeText =
        shareRoute.trim() || `${copy.vehicleLabels[shareType]} Live Trip`;
      firstGpsWriteRef.current = true;
      lastGpsWriteAtRef.current = 0;
      setIsBroadcastingGps(true);
      setShareSetupOpen(false);

      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (!firstGpsWriteRef.current && now - lastGpsWriteAtRef.current < 4000) {
            return;
          }
          lastGpsWriteAtRef.current = now;
          const isFirst = firstGpsWriteRef.current;

          const loc = {lat: pos.coords.latitude, lng: pos.coords.longitude};
          setUserLocation(loc);

          void upsertLiveGpsTrip({
            type: shareType,
            routeLabel: routeText,
            occupancy: shareOccupancy,
            lat: loc.lat,
            lng: loc.lng,
            speedMps: pos.coords.speed ?? 0,
            heading: pos.coords.heading ?? 0,
            isFirstWrite: isFirst,
          })
            .then(() => {
              firstGpsWriteRef.current = false;
            })
            .catch((err: unknown) => {
              setAuthNotice(err instanceof Error ? err.message : 'Unable to sync GPS.');
            });
        },
        () => {
          setAuthNotice('GPS signal lost. Please check device location permission.');
          void stopBroadcast();
        },
        {enableHighAccuracy: true, maximumAge: 2000, timeout: 10000}
      );
    },
    [currentUser, shareRoute, shareType, shareOccupancy, copy, stopBroadcast]
  );

  const handleDropCustomZonePin = useCallback(
    async (location: LatLngPoint) => {
      if (!currentUser) {
        setAuthNotice(copy.signInToContribute);
        setIsPinMode(false);
        return;
      }
      const id = `zone_${Date.now()}_${currentUser.uid.slice(0, 6)}`;
      const newZone: LoadingZone = {
        id,
        name: `Loading Zone near ${areaLabel}`.slice(0, 120),
        address: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        location,
        source: 'custom',
        allowedVehicles: ['jeep', 'bus', 'taxi'],
        ruleType: 'loading_unloading',
        status: 'active',
        landmarkTip: 'Community-pinned loading/unloading bay. Stand safely behind the curb.',
        fareRange: '₱13 – ₱25',
      };
      setIsPinMode(false);
      setSelectedZoneId(id);
      await createCommunityZone(newZone);
    },
    [currentUser, areaLabel, copy.signInToContribute]
  );

  const handleUpdateZone = useCallback(
    async (zoneId: string, patch: Partial<LoadingZone>) => {
      if (patch.hidden !== undefined && Object.keys(patch).length === 1) {
        setHiddenZoneIds((prev) => ({...prev, [zoneId]: Boolean(patch.hidden)}));
        return;
      }
      if (!currentUser) {
        setAuthNotice(copy.signInToContribute);
        return;
      }
      const target = allZones.find((z) => z.id === zoneId);
      if (!target) return;

      if (target.source === 'custom') {
        const isOwner = target.authorUid === currentUser.uid;
        await updateCommunityZone(zoneId, patch, isOwner);
      } else if (patch.status) {
        await reportZoneStatus({
          zoneId: target.id,
          zoneName: target.name,
          status: patch.status,
          queueNote: target.queueNote ?? '',
          hasExistingReport: Boolean(statusReports[target.id]),
        });
      }
    },
    [currentUser, allZones, statusReports, copy.signInToContribute]
  );

  const handleDeleteZone = useCallback(
    async (zoneId: string) => {
      if (!currentUser) {
        setAuthNotice(copy.signInToContribute);
        return;
      }
      await deleteCommunityZone(zoneId);
    },
    [currentUser, copy.signInToContribute]
  );

  const handleImportZones = useCallback(
    async (imported: LoadingZone[]) => {
      if (!currentUser) {
        setAuthNotice(copy.signInToContribute);
        return;
      }
      for (const item of imported.slice(0, 15)) {
        await createCommunityZone({
          ...item,
          id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        });
      }
    },
    [currentUser, copy.signInToContribute]
  );

  const handleResetCache = useCallback(() => {
    setHiddenZoneIds({});
    localStorage.removeItem(LOCAL_HIDE_STORAGE_KEY);
  }, []);

  const handleSpotVehicle = useCallback(
    async (payload: {
      type: VehicleType;
      routeLabel: string;
      occupancy: 'seats' | 'standing' | 'full';
      etaMinutes: number;
    }) => {
      if (!selectedZone) return;
      await postVehicleSighting({
        zone: selectedZone,
        type: payload.type,
        routeLabel: payload.routeLabel,
        occupancy: payload.occupancy,
        etaMinutes: payload.etaMinutes,
      });
    },
    [selectedZone]
  );

  const handleToggleWaiting = useCallback(async () => {
    if (!selectedZone || !currentUser) return;
    if (isUserWaitingAtSelectedZone) {
      await removeWaitingCheckin();
    } else {
      const hasExisting = waitingCheckins.some((wc) => wc.userUid === currentUser.uid);
      await upsertWaitingCheckin({
        zone: selectedZone,
        vehicleWanted: vehicleFilter,
        hasExisting,
      });
    }
  }, [
    selectedZone,
    currentUser,
    isUserWaitingAtSelectedZone,
    waitingCheckins,
    vehicleFilter,
  ]);

  const handleReportZoneCondition = useCallback(
    async (status: ZoneStatus, queueNote: string) => {
      if (!selectedZone) return;
      await reportZoneStatus({
        zoneId: selectedZone.id,
        zoneName: selectedZone.name,
        status,
        queueNote,
        hasExistingReport: Boolean(statusReports[selectedZone.id]),
      });
    },
    [selectedZone, statusReports]
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 1-row, 3-zone header separated by gap-8 */}
      <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <a
            href="#live-zones"
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SakayZone
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#live-zones"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navLiveZones}
            </a>
            <a
              href="#arrivals-board"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navArrivals}
            </a>
            <a
              href="#newcomer-guide"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navNewcomer}
            </a>
            <a
              href="#manage-stops"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {copy.navManage}
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsTikTokModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Video className="h-3.5 w-3.5 text-slate-900" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.shareToTikTok}</span>
            </button>

            <PWAInstallButton />

            {currentUser ? (
              <button
                type="button"
                onClick={() => void signOutAccount()}
                title={copy.signOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {currentUser.displayName?.split(' ')[0] || copy.signOut}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.signIn}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLocateMe}
              disabled={isLocating}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isLocating ? copy.locating : copy.locateMe}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Non-blocking Auth / GPS Notice */}
      {authNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span>{authNotice}</span>
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  {copy.signIn}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAuthNotice(null)}
              aria-label="Dismiss"
              className="text-amber-800 hover:text-amber-950"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <section id="live-zones" className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1
                className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900"
                style={{textWrap: 'balance'}}
              >
                {areaLabel} Loading &amp; Unloading Monitor
              </h1>
              <p className="mt-1 text-sm text-slate-600">{copy.searchHint}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Filter by vehicle type"
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => setVehicleFilter('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    vehicleFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {copy.filterAll}
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleFilter('jeep')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    vehicleFilter === 'jeep'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BusFront className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.jeep}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleFilter('bus')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    vehicleFilter === 'bus'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Bus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.bus}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleFilter('taxi')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    vehicleFilter === 'taxi'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CarTaxiFront className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.taxi}</span>
                </button>
              </div>

              {isBroadcastingGps ? (
                <button
                  type="button"
                  onClick={() => void stopBroadcast()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.stopSharingRide}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      setAuthNotice(copy.signInToContribute);
                      return;
                    }
                    setShareSetupOpen((prev) => !prev);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Radio className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  <span>{copy.shareRide}</span>
                </button>
              )}

              <div
                role="group"
                aria-label="Language"
                className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1"
              >
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    language === 'en'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('fil')}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    language === 'fil'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  FIL
                </button>
              </div>
            </div>
          </div>

          {/* Active Live GPS Broadcast Confirmation Strip */}
          {isBroadcastingGps && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-950">
              <div className="flex items-center gap-2 min-w-0">
                <Radio className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span className="font-semibold">{copy.broadcastActiveLabel}</span>
                <span className="truncate font-mono font-bold">
                  {copy.vehicleLabels[shareType]} ·{' '}
                  {shareRoute.trim() || `${copy.vehicleLabels[shareType]} Live Trip`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void stopBroadcast()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Square className="h-3 w-3" aria-hidden="true" />
                <span>{copy.stopSharingRide}</span>
              </button>
            </div>
          )}

          {/* Live GPS Broadcast Setup Panel */}
          {shareSetupOpen && !isBroadcastingGps && (
            <form
              onSubmit={startBroadcast}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">{copy.sharingLiveTitle}</div>
                <p className="mt-0.5 text-xs text-slate-600">{copy.sharingLiveHint}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <select
                  value={shareType}
                  onChange={(e) => setShareType(e.target.value as VehicleType)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="jeep">{copy.jeep}</option>
                  <option value="bus">{copy.bus}</option>
                  <option value="taxi">{copy.taxi}</option>
                </select>
                <input
                  type="text"
                  maxLength={120}
                  value={shareRoute}
                  onChange={(e) => setShareRoute(e.target.value)}
                  placeholder="Signboard / route (e.g. Quiapo - Philcoa)"
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
                <select
                  value={shareOccupancy}
                  onChange={(e) =>
                    setShareOccupancy(e.target.value as 'seats' | 'standing' | 'full')
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="seats">{copy.seatsAvailable}</option>
                  <option value="standing">{copy.standingRoom}</option>
                  <option value="full">{copy.fullLoad}</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShareSetupOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.startBroadcastBtn}</span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7">
              <AreaSearchBar
                placeholder={copy.searchPlaceholder}
                onAreaSelected={handleAreaSelected}
              />
            </div>
            <div className="lg:col-span-5 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 h-11">
              <div className="min-w-0 flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="h-4 w-4 shrink-0 text-slate-900" aria-hidden="true" />
                <span className="truncate font-medium text-slate-900">
                  {selectedZone ? selectedZone.name : copy.noZonesTitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!currentUser && !isPinMode) {
                    setAuthNotice(copy.signInToContribute);
                    return;
                  }
                  setIsPinMode((prev) => !prev);
                }}
                className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                  isPinMode
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <MapPinPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isPinMode ? copy.pinModeOn : copy.pinZoneCta}</span>
              </button>
            </div>
          </div>

          {/* Offline Saved Areas & Wi-Fi Map Preload Bar */}
          {savedOfflineAreas.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="text-[11px] font-semibold text-slate-600 mr-1">
                  {copy.savedAreasLabel}
                </span>
                {savedOfflineAreas.map((area) => {
                  const currentKey = `${mapCenter.lat.toFixed(3)},${mapCenter.lng.toFixed(3)}`;
                  const isActive = area.key === currentKey;
                  return (
                    <button
                      key={area.key}
                      type="button"
                      onClick={() => {
                        setAreaLabel(area.label);
                        setMapCenter(area.center);
                        setMapZoom(15);
                        setSelectedVehicleId(null);
                        setOsmZones(area.zones);
                        setMappedRoutes(area.routes);
                        setIsLoadingZones(false);
                        setIsLoadingRoutes(false);
                        if (area.zones[0]) setSelectedZoneId(area.zones[0].id);
                      }}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {area.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={isCachingOffline}
                onClick={() => {
                  const key = `${mapCenter.lat.toFixed(3)},${mapCenter.lng.toFixed(3)}`;
                  setIsCachingOffline(true);
                  void preloadOsmTilesAround(mapCenter).then(() => {
                    setIsCachingOffline(false);
                    setOfflineCacheDoneKey(key);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {offlineCacheDoneKey ===
                `${mapCenter.lat.toFixed(3)},${mapCenter.lng.toFixed(3)}` ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    <span>
                      {language === 'fil' ? 'Naka-save ang Mapa' : 'Map Cached Offline'}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
                    <span>
                      {isCachingOffline
                        ? language === 'fil'
                          ? 'Sini-save ang mapa...'
                          : 'Caching map...'
                        : language === 'fil'
                          ? 'I-save ang Mapa Offline'
                          : 'Save Map Offline'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 flex flex-col min-h-[340px] lg:min-h-[600px]">
              <TransitMapView
                center={mapCenter}
                zoom={mapZoom}
                zones={allZones}
                selectedZoneId={selectedZone?.id ?? null}
                vehicles={filteredVehicles}
                selectedVehicleId={selectedVehicleId}
                mappedRoutes={mappedRoutes}
                selectedRouteId={selectedRouteId}
                activeFilter={vehicleFilter}
                userLocation={userLocation}
                walkingPath={walkingInfo?.path ?? null}
                waitingCountsByZone={waitingCountsByZone}
                isPinMode={isPinMode}
                copy={copy}
                onSelectZone={(id) => {
                  setSelectedZoneId(id);
                  setSelectedVehicleId(null);
                  const found = allZones.find((z) => z.id === id);
                  if (found) setMapCenter(found.location);
                }}
                onSelectVehicle={(id) => setSelectedVehicleId(id)}
                onSelectRoute={(id) => setSelectedRouteId(id)}
                onDropCustomZonePin={(loc) => void handleDropCustomZonePin(loc)}
                onQuickStartLive={() => {
                  if (!currentUser) {
                    setAuthNotice(copy.signInToContribute);
                    window.scrollTo({top: 0, behavior: 'smooth'});
                    return;
                  }
                  setShareSetupOpen(true);
                  window.scrollTo({top: 0, behavior: 'smooth'});
                }}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col gap-5">
              <ArrivalsBoard
                selectedZone={selectedZone}
                vehicles={filteredVehicles}
                allZoneVehicles={liveVehicles}
                selectedVehicleId={selectedVehicleId}
                activeFilter={vehicleFilter}
                isLoadingZones={isLoadingZones}
                mappedRoutes={mappedRoutes}
                selectedRouteId={selectedRouteId}
                isLoadingRoutes={isLoadingRoutes}
                waitingCount={selectedZoneWaitingCount}
                isUserWaitingHere={isUserWaitingAtSelectedZone}
                isSignedIn={Boolean(currentUser)}
                copy={copy}
                onSelectVehicle={(id) => {
                  setSelectedVehicleId(id);
                  const found = liveVehicles.find((v) => v.id === id);
                  if (found) setMapCenter(found.position);
                }}
                onSelectRoute={(route) => {
                  setSelectedRouteId(route ? route.id : null);
                  if (route?.focusPoint) {
                    setMapCenter(route.focusPoint);
                    setMapZoom(15);
                  }
                }}
                onChangeFilter={setVehicleFilter}
                onShareLiveRide={(presetType) => {
                  if (!currentUser) {
                    setAuthNotice(copy.signInToContribute);
                    return;
                  }
                  if (presetType) setShareType(presetType);
                  setShareSetupOpen(true);
                  window.scrollTo({top: 0, behavior: 'smooth'});
                }}
                onRequireAuth={() => {
                  setAuthNotice(copy.signInToContribute);
                  if (window.scrollY > 100) {
                    window.scrollTo({top: 0, behavior: 'smooth'});
                  }
                }}
                onSpotVehicle={handleSpotVehicle}
                onToggleWaiting={handleToggleWaiting}
                onReportZoneCondition={handleReportZoneCondition}
              />

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                  <h2 className="text-sm font-bold text-slate-900">
                    {copy.loadingZonesHeading}
                  </h2>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {visibleZones.length}
                  </span>
                </div>

                {isLoadingZones ? (
                  <div className="divide-y divide-slate-100">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="px-5 py-3 space-y-1.5">
                        <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : visibleZones.length === 0 ? (
                  <div className="p-5 text-center space-y-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {copy.noZonesTitle}
                    </div>
                    <p className="text-xs text-slate-500">{copy.noZonesBody}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUser) {
                          setAuthNotice(copy.signInToContribute);
                          return;
                        }
                        setIsPinMode(true);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <MapPinPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.pinZoneCta}</span>
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[210px] overflow-y-auto divide-y divide-slate-100">
                    {visibleZones.map((zone) => {
                      const active = zone.id === selectedZone?.id;
                      const waitCount = waitingCountsByZone[zone.id] ?? 0;
                      return (
                        <button
                          key={zone.id}
                          type="button"
                          onClick={() => {
                            setSelectedZoneId(zone.id);
                            setSelectedVehicleId(null);
                            setMapCenter(zone.location);
                            setMapZoom(16);
                          }}
                          className={`flex w-full items-start justify-between gap-3 px-5 py-3 text-left transition-colors ${
                            active ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-900'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {zone.name}
                              {waitCount > 0 ? ` · ${waitCount} waiting` : ''}
                            </div>
                            <div
                              className={`mt-0.5 truncate text-xs ${
                                active ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {copy.rules[zone.ruleType]} ·{' '}
                              {zone.allowedVehicles.map((v) => copy.vehicleLabels[v]).join(' / ')}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 text-[11px] font-semibold ${
                              active
                                ? 'text-slate-200'
                                : zone.status === 'closed'
                                  ? 'text-rose-700'
                                  : zone.status === 'congested'
                                    ? 'text-amber-700'
                                    : 'text-emerald-700'
                            }`}
                          >
                            {copy.statuses[zone.status]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <NewcomerGuide
          selectedZone={selectedZone}
          vehicles={filteredVehicles}
          weather={zoneWeather}
          walkingSummary={walkingInfo}
          copy={copy}
        />

        <ManageZonesPanel
          zones={allZones}
          selectedZoneId={selectedZone?.id ?? null}
          isPinMode={isPinMode}
          currentUid={currentUser?.uid ?? null}
          copy={copy}
          onTogglePinMode={() => {
            if (!currentUser && !isPinMode) {
              setAuthNotice(copy.signInToContribute);
              return;
            }
            setIsPinMode((prev) => !prev);
          }}
          onSelectZone={(id) => {
            setSelectedZoneId(id);
            const found = allZones.find((z) => z.id === id);
            if (found) {
              setMapCenter(found.location);
              setMapZoom(16);
            }
          }}
          onUpdateZone={(id, patch) => void handleUpdateZone(id, patch)}
          onDeleteZone={(id) => void handleDeleteZone(id)}
          onImportZones={(imp) => void handleImportZones(imp)}
          onResetCustomZones={handleResetCache}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 sm:px-6 lg:px-8 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            SakayZone · Commuter Loading &amp; Unloading Zone Monitor · Created by{' '}
            <span className="font-semibold text-slate-700">Prince Cadahen</span>
          </div>
          <div>
            Map &amp; transit data by OpenStreetMap contributors · Weather by Open-Meteo.
          </div>
        </div>
      </footer>
      <OfflineIndicator />
      <TikTokShareModal
        isOpen={isTikTokModalOpen}
        areaLabel={areaLabel}
        selectedZone={selectedZone}
        vehicles={filteredVehicles}
        mappedRoutes={mappedRoutes}
        waitingCount={selectedZoneWaitingCount}
        weather={zoneWeather}
        copy={copy}
        onClose={() => setIsTikTokModalOpen(false)}
      />
    </div>
  );
}
