import React, {useState} from 'react';
import {
  Bus,
  BusFront,
  CarTaxiFront,
  CheckCircle2,
  Clock,
  Info,
  Plus,
  Radio,
  Route,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {
  LoadingZone,
  MappedTransitRoute,
  TrackedVehicle,
  VehicleType,
  ZoneStatus,
} from '../types/transit';

interface ArrivalsBoardProps {
  selectedZone: LoadingZone | null;
  vehicles: TrackedVehicle[];
  selectedVehicleId: string | null;
  activeFilter: 'all' | VehicleType;
  isLoadingZones: boolean;
  mappedRoutes: MappedTransitRoute[];
  isLoadingRoutes: boolean;
  waitingCount: number;
  isUserWaitingHere: boolean;
  isSignedIn: boolean;
  copy: CopyDictionary;
  onSelectVehicle: (vehicleId: string) => void;
  onRequireAuth: () => void;
  onSpotVehicle: (payload: {
    type: VehicleType;
    routeLabel: string;
    occupancy: 'seats' | 'standing' | 'full';
    etaMinutes: number;
  }) => Promise<void>;
  onToggleWaiting: () => Promise<void>;
  onReportZoneCondition: (status: ZoneStatus, queueNote: string) => Promise<void>;
}

function formatDistance(meters: number, copy: CopyDictionary): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} ${copy.kmShort}`;
  }
  return `${Math.max(10, Math.round(meters))} ${copy.mShort}`;
}

function formatEta(seconds: number, copy: CopyDictionary): string {
  if (seconds <= 35) return copy.arrivingNow;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} ${copy.minShort}`;
}

function formatAgo(timestampMs: number | undefined): string {
  if (!timestampMs) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 45) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const ArrivalsBoard: React.FC<ArrivalsBoardProps> = ({
  selectedZone,
  vehicles,
  selectedVehicleId,
  activeFilter,
  isLoadingZones,
  mappedRoutes,
  isLoadingRoutes,
  waitingCount,
  isUserWaitingHere,
  isSignedIn,
  copy,
  onSelectVehicle,
  onRequireAuth,
  onSpotVehicle,
  onToggleWaiting,
  onReportZoneCondition,
}) => {
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotType, setSpotType] = useState<VehicleType>('jeep');
  const [spotRoute, setSpotRoute] = useState('');
  const [spotOccupancy, setSpotOccupancy] = useState<'seats' | 'standing' | 'full'>('seats');
  const [spotEta, setSpotEta] = useState(3);
  const [isSubmittingSpot, setIsSubmittingSpot] = useState(false);

  const [conditionOpen, setConditionOpen] = useState(false);
  const [condStatus, setCondStatus] = useState<ZoneStatus>('active');
  const [condNote, setCondNote] = useState('');
  const [isSubmittingCond, setIsSubmittingCond] = useState(false);

  const sortedVehicles = [...vehicles].sort((a, b) => a.etaSeconds - b.etaSeconds);
  const jeepCount = sortedVehicles.filter((v) => v.type === 'jeep').length;
  const busCount = sortedVehicles.filter((v) => v.type === 'bus').length;
  const taxiCount = sortedVehicles.filter((v) => v.type === 'taxi').length;

  const summaryParts: string[] = [];
  if (jeepCount > 0) summaryParts.push(`${jeepCount} ${copy.jeep}`);
  if (busCount > 0) summaryParts.push(`${busCount} ${copy.bus}`);
  if (taxiCount > 0) summaryParts.push(`${taxiCount} ${copy.taxi}`);

  const handleOpenSpot = () => {
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    setSpotOpen((prev) => !prev);
    setConditionOpen(false);
  };

  const handleOpenCondition = () => {
    if (!isSignedIn) {
      onRequireAuth();
      return;
    }
    if (selectedZone) {
      setCondStatus(selectedZone.status);
      setCondNote(selectedZone.queueNote ?? '');
    }
    setConditionOpen((prev) => !prev);
    setSpotOpen(false);
  };

  const handleSubmitSpot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSpot(true);
    try {
      await onSpotVehicle({
        type: spotType,
        routeLabel: spotRoute.trim() || `${copy.vehicleLabels[spotType]} approaching`,
        occupancy: spotOccupancy,
        etaMinutes: spotEta,
      });
      setSpotRoute('');
      setSpotEta(3);
      setSpotOpen(false);
    } finally {
      setIsSubmittingSpot(false);
    }
  };

  const handleSubmitCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingCond(true);
    try {
      await onReportZoneCondition(condStatus, condNote.trim());
      setConditionOpen(false);
    } finally {
      setIsSubmittingCond(false);
    }
  };

  return (
    <section
      id="arrivals-board"
      className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {copy.arrivalsTitle}
          </h2>
          {selectedZone && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {selectedZone.name} · {copy.statuses[selectedZone.status]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleOpenSpot}
          disabled={!selectedZone}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{copy.spotVehicle}</span>
        </button>
      </div>

      {/* Live Queue & Waiting Check-in Strip */}
      {selectedZone && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Users className="h-3.5 w-3.5 text-slate-700 shrink-0" aria-hidden="true" />
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {waitingCount}
            </span>
            <span>{copy.waitingHereSuffix}</span>
            {selectedZone.queueNote && (
              <span className="text-amber-800 font-medium truncate max-w-[190px]">
                · {selectedZone.queueNote}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!isSignedIn) {
                  onRequireAuth();
                  return;
                }
                void onToggleWaiting();
              }}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                isUserWaitingHere
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              {isUserWaitingHere ? copy.stopWaiting : copy.imWaiting}
            </button>
            <button
              type="button"
              onClick={handleOpenCondition}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              {copy.reportConditionBtn}
            </button>
          </div>
        </div>
      )}

      {/* Update Zone Condition Inline Form */}
      {conditionOpen && selectedZone && (
        <form
          onSubmit={(e) => void handleSubmitCondition(e)}
          className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 space-y-2.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={condStatus}
              onChange={(e) => setCondStatus(e.target.value as ZoneStatus)}
              aria-label={copy.zoneStatusLabel}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="active">{copy.statuses.active}</option>
              <option value="congested">{copy.statuses.congested}</option>
              <option value="closed">{copy.statuses.closed}</option>
            </select>
            <input
              type="text"
              maxLength={180}
              value={condNote}
              onChange={(e) => setCondNote(e.target.value)}
              placeholder={copy.queueNotePlaceholder}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConditionOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmittingCond}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {copy.saveZone}
            </button>
          </div>
        </form>
      )}

      {/* Live Commuter Check Verdict */}
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {copy.newcomerBadge}
        </div>
        {isLoadingZones ? (
          <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        ) : sortedVehicles.length > 0 ? (
          <div className="mt-1 flex items-start gap-2 text-sm font-medium text-slate-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              {copy.verdictYesPrefix}{' '}
              <span className="font-semibold">{summaryParts.join(', ')}</span>{' '}
              {copy.verdictYesSuffix}
            </span>
          </div>
        ) : (
          <div className="mt-1 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              {activeFilter === 'all' ? copy.verdictNone : copy.verdictNone}
            </span>
          </div>
        )}
      </div>

      {/* Crowdsource Spot Vehicle Inline Form */}
      {spotOpen && selectedZone && (
        <form
          onSubmit={(e) => void handleSubmitSpot(e)}
          className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 space-y-3"
        >
          <div>
            <div className="text-xs font-bold text-slate-900">{copy.spotModalTitle}</div>
            <p className="mt-0.5 text-xs text-slate-500">{copy.spotModalSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={spotType}
              onChange={(e) => setSpotType(e.target.value as VehicleType)}
              aria-label={copy.vehicleCol}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="jeep">{copy.jeep}</option>
              <option value="bus">{copy.bus}</option>
              <option value="taxi">{copy.taxi}</option>
            </select>
            <input
              type="text"
              maxLength={120}
              value={spotRoute}
              onChange={(e) => setSpotRoute(e.target.value)}
              placeholder="Signboard / route (e.g. Cubao - Quiapo)"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
            <select
              value={spotOccupancy}
              onChange={(e) => setSpotOccupancy(e.target.value as 'seats' | 'standing' | 'full')}
              aria-label={copy.loadCol}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value="seats">{copy.seatsAvailable}</option>
              <option value="standing">{copy.standingRoom}</option>
              <option value="full">{copy.fullLoad}</option>
            </select>
            <select
              value={spotEta}
              onChange={(e) => setSpotEta(Number(e.target.value))}
              aria-label={copy.etaCol}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value={1}>~1 {copy.minShort}</option>
              <option value={3}>~3 {copy.minShort}</option>
              <option value={5}>~5 {copy.minShort}</option>
              <option value={10}>~10 {copy.minShort}</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSpotOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmittingSpot}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {copy.submitSpot}
            </button>
          </div>
        </form>
      )}

      {/* Real Live Vehicles & Sightings Table */}
      {sortedVehicles.length > 0 && (
        <div className="overflow-x-auto border-b border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pl-5 pr-3">{copy.vehicleCol}</th>
                <th className="py-2.5 px-3">{copy.routeCol}</th>
                <th className="py-2.5 px-3">{copy.loadCol}</th>
                <th className="py-2.5 pl-3 pr-5 text-right">{copy.etaCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {sortedVehicles.map((vehicle) => {
                const isSelected = vehicle.id === selectedVehicleId;
                const Icon =
                  vehicle.type === 'jeep'
                    ? BusFront
                    : vehicle.type === 'bus'
                      ? Bus
                      : CarTaxiFront;
                const typeColor =
                  vehicle.type === 'jeep'
                    ? 'text-amber-700'
                    : vehicle.type === 'bus'
                      ? 'text-blue-700'
                      : 'text-emerald-700';
                const loadLabel =
                  vehicle.occupancy === 'seats'
                    ? copy.seatsAvailable
                    : vehicle.occupancy === 'standing'
                      ? copy.standingRoom
                      : copy.fullLoad;

                return (
                  <tr
                    key={vehicle.id}
                    onClick={() => onSelectVehicle(vehicle.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2.5 pl-5 pr-3 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 shrink-0 ${typeColor}`} aria-hidden="true" />
                        <div>
                          <div className={`text-xs font-semibold ${typeColor}`}>
                            {copy.vehicleLabels[vehicle.type]}
                          </div>
                          <div className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-slate-500">
                            {vehicle.liveMode === 'gps' && (
                              <Radio className="h-2.5 w-2.5 text-emerald-600" aria-hidden="true" />
                            )}
                            <span>
                              {vehicle.liveMode === 'gps'
                                ? copy.liveGpsLabel
                                : formatAgo(vehicle.reportedAtMs)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-middle min-w-[150px]">
                      <div className="text-xs font-semibold text-slate-900 truncate max-w-[210px]">
                        {vehicle.routeLabel}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                        {vehicle.reporterName || vehicle.plateNumber}
                        {vehicle.isSelf ? ' (You)' : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-middle whitespace-nowrap text-xs text-slate-600">
                      {loadLabel}
                    </td>
                    <td className="py-2.5 pl-3 pr-5 align-middle text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1 font-mono text-xs font-bold text-slate-900 tabular-nums">
                        <Clock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                        <span>{formatEta(vehicle.etaSeconds, copy)}</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {formatDistance(vehicle.distanceMeters, copy)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Real OpenStreetMap Mapped Transit Routes Nearby */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Route className="h-3.5 w-3.5 text-slate-700" aria-hidden="true" />
            <span>{copy.mappedRoutesTitle}</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {mappedRoutes.length}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">{copy.mappedRoutesSubtitle}</p>

        {isLoadingRoutes ? (
          <div className="space-y-1.5 pt-1">
            <div className="h-3.5 w-48 animate-pulse rounded bg-slate-100" />
            <div className="h-3.5 w-56 animate-pulse rounded bg-slate-100" />
          </div>
        ) : mappedRoutes.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{copy.noMappedRoutes}</span>
          </div>
        ) : (
          <div className="max-h-[155px] overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
            {mappedRoutes.map((rt) => (
              <div key={rt.id} className="flex items-start justify-between gap-2 py-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{rt.name}</div>
                  {(rt.from || rt.to || rt.operator) && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {[rt.from && rt.to ? `${rt.from} → ${rt.to}` : null, rt.operator]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-slate-600">
                  {rt.ref}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
