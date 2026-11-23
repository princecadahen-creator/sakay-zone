import React, {useEffect, useRef} from 'react';
import L from 'leaflet';
import {MapPin} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {LatLngPoint, LoadingZone, TrackedVehicle, VehicleType} from '../types/transit';

interface TransitMapViewProps {
  center: LatLngPoint;
  zoom: number;
  zones: LoadingZone[];
  selectedZoneId: string | null;
  vehicles: TrackedVehicle[];
  selectedVehicleId: string | null;
  userLocation: LatLngPoint | null;
  isPinMode: boolean;
  copy: CopyDictionary;
  onSelectZone: (zoneId: string) => void;
  onSelectVehicle: (vehicleId: string | null) => void;
  onDropCustomZonePin: (location: LatLngPoint) => void;
}

const VEHICLE_META: Record<
  VehicleType,
  {hex: string; short: string}
> = {
  jeep: {hex: '#D97706', short: 'JEEP'},
  bus: {hex: '#2563EB', short: 'BUS'},
  taxi: {hex: '#059669', short: 'TAXI'},
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEtaShort(seconds: number, copy: CopyDictionary): string {
  if (seconds <= 35) return copy.arrivingNow;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} ${copy.minShort}`;
}

export const TransitMapView: React.FC<TransitMapViewProps> = ({
  center,
  zoom,
  zones,
  selectedZoneId,
  vehicles,
  selectedVehicleId,
  userLocation,
  isPinMode,
  copy,
  onSelectZone,
  onSelectVehicle,
  onDropCustomZonePin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylinesLayerRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);

  const isPinModeRef = useRef(isPinMode);
  isPinModeRef.current = isPinMode;

  const onDropPinRef = useRef(onDropCustomZonePin);
  onDropPinRef.current = onDropCustomZonePin;

  const onSelectVehicleRef = useRef(onSelectVehicle);
  onSelectVehicleRef.current = onSelectVehicle;

  const onSelectZoneRef = useRef(onSelectZone);
  onSelectZoneRef.current = onSelectZone;

  const lastCameraRef = useRef<string>('');

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    polylinesLayerRef.current = L.layerGroup().addTo(map);
    zonesLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (isPinModeRef.current) {
        onDropPinRef.current({lat: ev.latlng.lat, lng: ev.latlng.lng});
      } else {
        onSelectVehicleRef.current(null);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync camera center/zoom when area or zone changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom}`;
    if (key !== lastCameraRef.current) {
      lastCameraRef.current = key;
      map.setView([center.lat, center.lng], zoom, {animate: true});
    }
  }, [center, zoom]);

  // Update cursor in Pin Mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.cursor = isPinMode ? 'crosshair' : '';
  }, [isPinMode]);

  // Render User Location dot
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!userLocation) return;

    const icon = L.divIcon({
      className: 'sakayzone-user-dot',
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0F172A;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:7px;height:7px;border-radius:9999px;background:#38BDF8;"></div></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([userLocation.lat, userLocation.lng], {icon, zIndexOffset: 800})
      .bindPopup('<strong>Your Current Location</strong>')
      .addTo(layer);
  }, [userLocation]);

  // Render Road Polylines
  useEffect(() => {
    const layer = polylinesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const seenKeys: Record<string, boolean> = {};
    for (const veh of vehicles) {
      if (veh.path.length < 2) continue;
      const key = `${veh.path[0].lat.toFixed(4)},${veh.path[0].lng.toFixed(4)}-${veh.type}`;
      const isFocused = veh.id === selectedVehicleId;
      if (seenKeys[key] && !isFocused) continue;
      seenKeys[key] = true;

      L.polyline(
        veh.path.map((pt) => [pt.lat, pt.lng] as [number, number]),
        {
          color: VEHICLE_META[veh.type].hex,
          weight: isFocused ? 5 : 3,
          opacity: isFocused ? 0.9 : 0.45,
        }
      ).addTo(layer);
    }
  }, [vehicles, selectedVehicleId]);

  // Render Loading & Unloading Zone Markers
  useEffect(() => {
    const layer = zonesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    const visibleZones = zones.filter((z) => !z.hidden);

    for (const zone of visibleZones) {
      const isSelected = zone.id === selectedZoneId;
      const bg =
        zone.status === 'closed'
          ? '#BE123C'
          : zone.status === 'congested'
            ? '#B45309'
            : isSelected
              ? '#0F172A'
              : '#FFFFFF';
      const fg = isSelected || zone.status !== 'active' ? '#FFFFFF' : '#0F172A';
      const border = isSelected ? '#0F172A' : '#CBD5E1';

      const safeName = escapeHtml(zone.name);
      const safeRule = escapeHtml(copy.rules[zone.ruleType]);
      const safeStatus = escapeHtml(copy.statuses[zone.status]);
      const safeAddress = escapeHtml(zone.address);
      const safeTip = escapeHtml(zone.landmarkTip);

      const icon = L.divIcon({
        className: 'sakayzone-zone-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:${bg};color:${fg};border:1.5px solid ${border};border-radius:6px;padding:3px 8px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:700;white-space:nowrap;max-width:165px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(15,23,42,0.18);">
              ${safeName}
            </div>
            <div style="width:8px;height:8px;background:${bg};border-right:1.5px solid ${border};border-bottom:1.5px solid ${border};transform:rotate(45deg);margin-top:-4px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([zone.location.lat, zone.location.lng], {
        icon,
        zIndexOffset: isSelected ? 900 : 300,
      });

      marker.bindPopup(
        `<div style="min-width:200px;font-family:'DM Sans',sans-serif;">
          <div style="font-size:11px;font-weight:600;color:#64748B;">${safeRule} · ${safeStatus}</div>
          <div style="margin-top:2px;font-size:13px;font-weight:700;color:#0F172A;">${safeName}</div>
          <div style="margin-top:3px;font-size:11px;color:#475569;">${safeAddress}</div>
          <div style="margin-top:5px;font-size:11px;color:#334155;">${safeTip}</div>
        </div>`
      );

      marker.on('click', () => {
        onSelectZoneRef.current(zone.id);
      });

      marker.addTo(layer);
    }
  }, [zones, selectedZoneId, copy]);

  // Render Live Moving Vehicles
  useEffect(() => {
    const layer = vehiclesLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const veh of vehicles) {
      const isSelected = veh.id === selectedVehicleId;
      const meta = VEHICLE_META[veh.type];
      const etaText = escapeHtml(formatEtaShort(veh.etaSeconds, copy));
      const safeType = escapeHtml(copy.vehicleLabels[veh.type]);
      const safePlate = escapeHtml(veh.plateNumber);
      const safeCode = escapeHtml(veh.routeCode);
      const safeDest = escapeHtml(veh.destination);
      const safeFare = escapeHtml(veh.fareText);
      const distText =
        veh.distanceMeters >= 1000
          ? `${(veh.distanceMeters / 1000).toFixed(1)} ${escapeHtml(copy.kmShort)}`
          : `${veh.distanceMeters} ${escapeHtml(copy.mShort)}`;

      const ringStyle = isSelected ? 'box-shadow:0 0 0 2px #0F172A,0 4px 10px rgba(0,0,0,0.28);transform:scale(1.08);' : 'box-shadow:0 2px 6px rgba(0,0,0,0.22);';

      const icon = L.divIcon({
        className: 'sakayzone-vehicle-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-70%);cursor:pointer;">
            <div style="background:${meta.hex};color:#fff;border-radius:6px;padding:3px 7px;display:flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;white-space:nowrap;${ringStyle}">
              <span>${meta.short}</span>
              <span>·</span>
              <span>${etaText}</span>
            </div>
            <div style="margin-top:2px;width:14px;height:14px;border-radius:9999px;background:#fff;border:1.5px solid #CBD5E1;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(
              veh.heading
            )}deg);">
              <span style="font-size:9px;line-height:1;color:#0F172A;font-weight:800;">▲</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([veh.position.lat, veh.position.lng], {
        icon,
        zIndexOffset: isSelected ? 950 : 600,
      });

      marker.bindPopup(
        `<div style="min-width:190px;font-family:'DM Sans',sans-serif;">
          <div style="font-size:11px;font-weight:600;color:#64748B;">${safeType} · ${safePlate}</div>
          <div style="margin-top:2px;font-size:13px;font-weight:700;color:#0F172A;">${safeCode} — ${safeDest}</div>
          <div style="margin-top:5px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#0F172A;">
            <strong>${etaText}</strong> · ${distText} · ${safeFare}
          </div>
        </div>`
      );

      marker.on('click', () => {
        onSelectVehicleRef.current(veh.id);
      });

      marker.addTo(layer);
    }
  }, [vehicles, selectedVehicleId, copy]);

  return (
    <div className="relative h-full w-full min-h-[460px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-full w-full min-h-[460px] z-0" />

      {/* Map Pin Mode Banner */}
      {isPinMode && (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] flex justify-center">
          <div className="rounded-lg border border-slate-900 bg-slate-900/95 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {copy.pinInstruction}
          </div>
        </div>
      )}

      {/* Map Legend Strip (Bottom Left) */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-4 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-600" />
          <span>{copy.jeep}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-600" />
          <span>{copy.bus}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          <span>{copy.taxi}</span>
        </div>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-900" aria-hidden="true" />
          <span>Loading Zone</span>
        </div>
      </div>
    </div>
  );
};
