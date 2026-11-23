import React, {useState} from 'react';
import {Bus, BusFront, CarTaxiFront, CheckCircle2, Clock, Plus, TriangleAlert} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {LoadingZone, TrackedVehicle, VehicleType} from '../types/transit';

interface ArrivalsBoardProps {
  selectedZone: LoadingZone | null;
  vehicles: TrackedVehicle[];
  selectedVehicleId: string | null;
  activeFilter: 'all' | VehicleType;
  isLoadingZones: boolean;
  copy: CopyDictionary;
  onSelectVehicle: (vehicleId: string) => void;
  onSpotVehicle: (payload: {type: VehicleType; routeLabel: string; etaMinutes: number}) => void;
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

export const ArrivalsBoard: React.FC<ArrivalsBoardProps> = ({
  selectedZone,
  vehicles,
  selectedVehicleId,
  activeFilter,
  isLoadingZones,
  copy,
  onSelectVehicle,
  onSpotVehicle,
}) => {
  const [spotOpen, setSpotOpen] = useState(false);
  const [spotType, setSpotType] = useState<VehicleType>('jeep');
  const [spotRoute, setSpotRoute] = useState('');
  const [spotEta, setSpotEta] = useState(3);

  const sortedVehicles = [...vehicles].sort((a, b) => a.etaSeconds - b.etaSeconds);

  const jeepCount = sortedVehicles.filter((v) => v.type === 'jeep').length;
  const busCount = sortedVehicles.filter((v) => v.type === 'bus').length;
  const taxiCount = sortedVehicles.filter((v) => v.type === 'taxi').length;

  const summaryParts: string[] = [];
  if (jeepCount > 0) summaryParts.push(`${jeepCount} ${copy.jeep}`);
  if (busCount > 0) summaryParts.push(`${busCount} ${copy.bus}`);
  if (taxiCount > 0) summaryParts.push(`${taxiCount} ${copy.taxi}`);

  const handleSubmitSpot = (e: React.FormEvent) => {
    e.preventDefault();
    onSpotVehicle({
      type: spotType,
      routeLabel: spotRoute.trim() || `${copy.vehicleLabels[spotType]} approaching`,
      etaMinutes: spotEta,
    });
    setSpotRoute('');
    setSpotEta(3);
    setSpotOpen(false);
  };

  return (
    <section
      id="arrivals-board"
      className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            {copy.arrivalsTitle}
          </h2>
          {selectedZone && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {selectedZone.name} · {copy.rules[selectedZone.ruleType]} ·{' '}
              {copy.statuses[selectedZone.status]}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSpotOpen((prev) => !prev)}
          disabled={!selectedZone}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{copy.spotVehicle}</span>
        </button>
      </div>

      {/* Newcomer Arrival Verdict */}
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
          <div className="mt-1 flex items-start gap-2 text-sm text-slate-600">
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
          onSubmit={handleSubmitSpot}
          className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 space-y-3"
        >
          <div>
            <div className="text-xs font-bold text-slate-900">{copy.spotModalTitle}</div>
            <p className="mt-0.5 text-xs text-slate-500">{copy.spotModalSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              value={spotRoute}
              onChange={(e) => setSpotRoute(e.target.value)}
              placeholder="Signboard / route (optional)"
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
            <select
              value={spotEta}
              onChange={(e) => setSpotEta(Number(e.target.value))}
              aria-label={copy.etaCol}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              <option value={1}>~1 {copy.minShort}</option>
              <option value={3}>~3 {copy.minShort}</option>
              <option value={5}>~5 {copy.minShort}</option>
              <option value={8}>~8 {copy.minShort}</option>
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
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {copy.submitSpot}
            </button>
          </div>
        </form>
      )}

      {/* High-density Arrivals Table */}
      <div className="overflow-x-auto">
        {isLoadingZones ? (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center justify-between px-5 py-3">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : sortedVehicles.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {copy.verdictNone}
          </div>
        ) : (
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
                          <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {vehicle.plateNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-middle min-w-[160px]">
                      <div className="text-xs font-semibold text-slate-900 truncate max-w-[210px]">
                        {vehicle.routeCode} · {vehicle.destination}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[210px]">
                        {vehicle.fareText}
                        {vehicle.isUserSpotted ? ' · Commuter spotted' : ''}
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
        )}
      </div>
    </section>
  );
};
