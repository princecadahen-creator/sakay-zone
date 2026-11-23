import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Bus,
  BusFront,
  CarTaxiFront,
  LocateFixed,
  MapPin,
  MapPinPlus,
  Pause,
  Play,
} from 'lucide-react';
import {AreaSearchBar} from './components/AreaSearchBar';
import {ArrivalsBoard} from './components/ArrivalsBoard';
import {ManageZonesPanel} from './components/ManageZonesPanel';
import {NewcomerGuide} from './components/NewcomerGuide';
import {TransitMapView} from './components/TransitMapView';
import {TRANSLATIONS} from './i18n/translations';
import {
  buildApproachingFleetForZone,
  discoverNearbyLoadingZones,
  interpolateAlongPath,
} from './services/transitDiscovery';
import type {
  Language,
  LatLngPoint,
  LoadingZone,
  TrackedVehicle,
  VehicleType,
} from './types/transit';

const DEFAULT_CENTER: LatLngPoint = {lat: 14.5995, lng: 120.9842};
const CUSTOM_ZONES_STORAGE_KEY = 'sakayzone_custom_zones_v1';
const ZONE_OVERRIDES_STORAGE_KEY = 'sakayzone_zone_overrides_v1';

function loadStoredCustomZones(): LoadingZone[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ZONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LoadingZone[]) : [];
  } catch {
    return [];
  }
}

function loadStoredOverrides(): Record<string, Partial<LoadingZone>> {
  try {
    const raw = localStorage.getItem(ZONE_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, Partial<LoadingZone>>) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const copy = TRANSLATIONS[language];

  const [mapCenter, setMapCenter] = useState<LatLngPoint>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [areaLabel, setAreaLabel] = useState<string>('Metro Manila');
  const [userLocation, setUserLocation] = useState<LatLngPoint | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [discoveredZones, setDiscoveredZones] = useState<LoadingZone[]>([]);
  const [customZones, setCustomZones] = useState<LoadingZone[]>(loadStoredCustomZones);
  const [zoneOverrides, setZoneOverrides] =
    useState<Record<string, Partial<LoadingZone>>>(loadStoredOverrides);
  const [isLoadingZones, setIsLoadingZones] = useState(true);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleFilter, setVehicleFilter] = useState<'all' | VehicleType>('all');
  const [isLiveRunning, setIsLiveRunning] = useState(true);
  const [isPinMode, setIsPinMode] = useState(false);

  const [fleet, setFleet] = useState<TrackedVehicle[]>([]);
  const fleetCacheRef = useRef<Record<string, TrackedVehicle[]>>({});
  const discoveredAreaCacheRef = useRef<Record<string, LoadingZone[]>>({});

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_ZONES_STORAGE_KEY, JSON.stringify(customZones));
    } catch {
      // Ignore storage quota errors
    }
  }, [customZones]);

  useEffect(() => {
    try {
      localStorage.setItem(ZONE_OVERRIDES_STORAGE_KEY, JSON.stringify(zoneOverrides));
    } catch {
      // Ignore storage quota errors
    }
  }, [zoneOverrides]);

  const allZones = useMemo(() => {
    const mergedMap: Record<string, LoadingZone> = {};
    for (const z of discoveredZones) {
      mergedMap[z.id] = {...z, ...(zoneOverrides[z.id] ?? {})};
    }
    for (const cz of customZones) {
      mergedMap[cz.id] = {...cz, ...(zoneOverrides[cz.id] ?? {})};
    }
    return Object.values(mergedMap);
  }, [discoveredZones, customZones, zoneOverrides]);

  const visibleZones = useMemo(() => allZones.filter((z) => !z.hidden), [allZones]);

  const selectedZone = useMemo(
    () => allZones.find((z) => z.id === selectedZoneId) ?? visibleZones[0] ?? null,
    [allZones, visibleZones, selectedZoneId]
  );

  const loadAreaZones = useCallback(
    async (targetCenter: LatLngPoint, label?: string) => {
      const cacheKey = `${targetCenter.lat.toFixed(3)},${targetCenter.lng.toFixed(3)}`;
      const cached = discoveredAreaCacheRef.current[cacheKey];
      if (cached) {
        setDiscoveredZones(cached);
        setIsLoadingZones(false);
        if (cached.length > 0) {
          setSelectedZoneId(cached[0].id);
        }
        return;
      }

      setIsLoadingZones(true);
      const zones = await discoverNearbyLoadingZones(targetCenter, label);
      discoveredAreaCacheRef.current[cacheKey] = zones;
      setDiscoveredZones(zones);
      setIsLoadingZones(false);

      if (zones.length > 0) {
        setSelectedZoneId(zones[0].id);
      } else if (customZones.length > 0) {
        setSelectedZoneId(customZones[0].id);
      } else {
        setSelectedZoneId(null);
      }
    },
    [customZones]
  );

  useEffect(() => {
    void loadAreaZones(DEFAULT_CENTER, 'Metro Manila');
  }, []);

  useEffect(() => {
    if (!selectedZone) {
      setFleet([]);
      return;
    }

    const cachedFleet = fleetCacheRef.current[selectedZone.id];
    if (cachedFleet) {
      setFleet(cachedFleet);
      return;
    }

    let cancelled = false;
    void buildApproachingFleetForZone(selectedZone, allZones).then((vehicles) => {
      if (!cancelled) {
        fleetCacheRef.current[selectedZone.id] = vehicles;
        setFleet(vehicles);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedZone?.id]);

  // Real-time vehicle telemetry loop along OSRM road polylines
  useEffect(() => {
    if (!isLiveRunning) return;

    const timer = window.setInterval(() => {
      setFleet((prevFleet) =>
        prevFleet.map((veh) => {
          const total = Math.max(100, veh.totalMeters);
          const deltaProgress = veh.speedMps / total;
          let nextProgress = veh.progress + deltaProgress;
          if (nextProgress >= 1) {
            nextProgress = 0.08;
          }
          const interp = interpolateAlongPath(veh.path, nextProgress);
          const remainingMeters = Math.max(15, Math.round(total * (1 - nextProgress)));
          const etaSeconds = Math.max(15, Math.round(remainingMeters / veh.speedMps));

          return {
            ...veh,
            progress: nextProgress,
            position: interp.position,
            heading: interp.heading,
            distanceMeters: remainingMeters,
            etaSeconds,
          };
        })
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isLiveRunning]);

  const filteredVehicles = useMemo(() => {
    if (vehicleFilter === 'all') return fleet;
    return fleet.filter((v) => v.type === vehicleFilter);
  }, [fleet, vehicleFilter]);

  const handleAreaSelected = useCallback(
    (loc: LatLngPoint, label: string) => {
      setAreaLabel(label);
      setMapCenter(loc);
      setMapZoom(15);
      setSelectedVehicleId(null);
      void loadAreaZones(loc, label);
    },
    [loadAreaZones]
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
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
        void loadAreaZones(nextLoc, 'Current Location');
      },
      () => {
        setIsLocating(false);
      },
      {enableHighAccuracy: true, timeout: 8000}
    );
  }, [loadAreaZones]);

  const handleDropCustomZonePin = useCallback(
    (location: LatLngPoint) => {
      const count = customZones.length + 1;
      const newZone: LoadingZone = {
        id: `custom-${Date.now()}`,
        name: `Loading Zone ${count}`,
        address: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
        location,
        source: 'custom',
        allowedVehicles: ['jeep', 'bus', 'taxi'],
        ruleType: 'loading_unloading',
        status: 'active',
        landmarkTip: 'Community-pinned loading/unloading bay. Stand safely on the sidewalk.',
        fareRange: '₱13 – ₱25',
      };
      setCustomZones((prev) => [newZone, ...prev]);
      setSelectedZoneId(newZone.id);
      setIsPinMode(false);
    },
    [customZones.length]
  );

  const handleUpdateZone = useCallback((zoneId: string, patch: Partial<LoadingZone>) => {
    setCustomZones((prev) =>
      prev.map((z) => (z.id === zoneId ? {...z, ...patch} : z))
    );
    setZoneOverrides((prev) => ({
      ...prev,
      [zoneId]: {...(prev[zoneId] ?? {}), ...patch},
    }));
  }, []);

  const handleDeleteZone = useCallback((zoneId: string) => {
    setCustomZones((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  const handleImportZones = useCallback((imported: LoadingZone[]) => {
    setCustomZones((prev) => {
      const existingById: Record<string, LoadingZone> = {};
      for (const z of prev) existingById[z.id] = z;
      for (const imp of imported) existingById[imp.id] = imp;
      return Object.values(existingById);
    });
    if (imported[0]) {
      setSelectedZoneId(imported[0].id);
      setMapCenter(imported[0].location);
      setMapZoom(15);
    }
  }, []);

  const handleResetCustomZones = useCallback(() => {
    setCustomZones([]);
    setZoneOverrides({});
    localStorage.removeItem(CUSTOM_ZONES_STORAGE_KEY);
    localStorage.removeItem(ZONE_OVERRIDES_STORAGE_KEY);
  }, []);

  const handleSpotVehicle = useCallback(
    (payload: {type: VehicleType; routeLabel: string; etaMinutes: number}) => {
      if (!selectedZone) return;
      const startPt: LatLngPoint = {
        lat: selectedZone.location.lat + 0.0045,
        lng: selectedZone.location.lng - 0.0035,
      };
      const path = [startPt, selectedZone.location];
      const progress = Math.max(0.15, Math.min(0.85, 1 - payload.etaMinutes / 10));
      const interp = interpolateAlongPath(path, progress);
      const etaSeconds = payload.etaMinutes * 60;
      const remainingMeters = Math.round(etaSeconds * 6.5);

      const spotted: TrackedVehicle = {
        id: `spotted-${Date.now()}`,
        type: payload.type,
        routeCode: payload.type === 'jeep' ? 'J-NEW' : payload.type === 'bus' ? 'B-NEW' : 'TX-NEW',
        routeLabel: payload.routeLabel,
        destination: selectedZone.name.split('—')[0].trim().slice(0, 24),
        plateNumber: 'REPORTED',
        occupancy: 'seats',
        fareText: payload.type === 'taxi' ? '₱45 flagdown' : '₱13.00 min',
        path,
        progress,
        speedMps: 6.5,
        totalMeters: Math.max(200, Math.round(remainingMeters / (1 - progress))),
        distanceMeters: remainingMeters,
        etaSeconds,
        position: interp.position,
        heading: interp.heading,
        targetZoneId: selectedZone.id,
        isUserSpotted: true,
      };

      setFleet((prev) => [spotted, ...prev]);
      setSelectedVehicleId(spotted.id);
    },
    [selectedZone]
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

          <div className="flex items-center shrink-0">
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

              <button
                type="button"
                onClick={() => setIsLiveRunning((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                {isLiveRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.pause}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.resume}</span>
                  </>
                )}
              </button>

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
                onClick={() => setIsPinMode((prev) => !prev)}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 flex flex-col min-h-[480px] lg:min-h-[600px]">
              <TransitMapView
                center={mapCenter}
                zoom={mapZoom}
                zones={allZones}
                selectedZoneId={selectedZone?.id ?? null}
                vehicles={filteredVehicles}
                selectedVehicleId={selectedVehicleId}
                userLocation={userLocation}
                isPinMode={isPinMode}
                copy={copy}
                onSelectZone={(id) => {
                  setSelectedZoneId(id);
                  setSelectedVehicleId(null);
                  const found = allZones.find((z) => z.id === id);
                  if (found) setMapCenter(found.location);
                }}
                onSelectVehicle={(id) => setSelectedVehicleId(id)}
                onDropCustomZonePin={handleDropCustomZonePin}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col gap-5">
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
                      onClick={() => setIsPinMode(true)}
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
                            <div className="truncate text-sm font-semibold">{zone.name}</div>
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

              <ArrivalsBoard
                selectedZone={selectedZone}
                vehicles={filteredVehicles}
                selectedVehicleId={selectedVehicleId}
                activeFilter={vehicleFilter}
                isLoadingZones={isLoadingZones}
                copy={copy}
                onSelectVehicle={(id) => {
                  setSelectedVehicleId(id);
                  const found = filteredVehicles.find((v) => v.id === id);
                  if (found) setMapCenter(found.position);
                }}
                onSpotVehicle={handleSpotVehicle}
              />
            </div>
          </div>
        </section>

        <NewcomerGuide
          selectedZone={selectedZone}
          vehicles={filteredVehicles}
          copy={copy}
        />

        <ManageZonesPanel
          zones={allZones}
          selectedZoneId={selectedZone?.id ?? null}
          isPinMode={isPinMode}
          copy={copy}
          onTogglePinMode={() => setIsPinMode((prev) => !prev)}
          onSelectZone={(id) => {
            setSelectedZoneId(id);
            const found = allZones.find((z) => z.id === id);
            if (found) {
              setMapCenter(found.location);
              setMapZoom(16);
            }
          }}
          onUpdateZone={handleUpdateZone}
          onDeleteZone={handleDeleteZone}
          onImportZones={handleImportZones}
          onResetCustomZones={handleResetCustomZones}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 sm:px-6 lg:px-8 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            SakayZone · Commuter Loading &amp; Unloading Zone Monitor · Created by{' '}
            <span className="font-semibold text-slate-700">Prince Cadahen</span>
          </div>
          <div>
            Map &amp; road network data by OpenStreetMap contributors.
          </div>
        </div>
      </footer>
    </div>
  );
}
