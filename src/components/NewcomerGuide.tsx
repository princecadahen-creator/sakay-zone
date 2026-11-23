import React from 'react';
import {
  Bus,
  BusFront,
  CarTaxiFront,
  CloudRain,
  Compass,
  Footprints,
  MapPin,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {LoadingZone, TrackedVehicle, ZoneWeatherInfo} from '../types/transit';

interface NewcomerGuideProps {
  selectedZone: LoadingZone | null;
  vehicles: TrackedVehicle[];
  weather: ZoneWeatherInfo | null;
  walkingSummary: {distanceMeters: number; durationSeconds: number} | null;
  copy: CopyDictionary;
}

export const NewcomerGuide: React.FC<NewcomerGuideProps> = ({
  selectedZone,
  vehicles,
  weather,
  walkingSummary,
  copy,
}) => {
  const nearestEta =
    vehicles.length > 0
      ? Math.max(1, Math.round(Math.min(...vehicles.map((v) => v.etaSeconds)) / 60))
      : null;

  return (
    <section
      id="newcomer-guide"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              {copy.newcomerSectionTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              {copy.newcomerSectionSubtitle}
            </p>
          </div>
          {nearestEta !== null && (
            <div className="mt-2 sm:mt-0 shrink-0 text-right">
              <div className="text-xs text-slate-500">{copy.etaCol}</div>
              <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                ~{nearestEta} {copy.minShort}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* Selected Zone Details + Live Weather & Walking Distance */}
        <div className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Compass className="h-4 w-4 text-slate-700" aria-hidden="true" />
            <span>{copy.zoneChecklistTitle}</span>
          </div>

          {selectedZone ? (
            <div className="space-y-4">
              <div>
                <div className="text-base font-bold text-slate-900">{selectedZone.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">{selectedZone.address}</div>
              </div>

              {(weather || walkingSummary) && (
                <div className="space-y-2">
                  {weather && (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 text-xs ${
                        weather.isRainy
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-200/80'
                      }`}
                    >
                      {weather.isRainy ? (
                        <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      ) : (
                        <Sun className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                      )}
                      <div>
                        <span className="font-mono font-bold tabular-nums">
                          {weather.temperatureC}°C
                        </span>{' '}
                        · {weather.isRainy ? copy.weatherRainAlert : copy.weatherClearLabel}
                      </div>
                    </div>
                  )}

                  {walkingSummary && (
                    <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Footprints className="h-4 w-4 text-slate-700" aria-hidden="true" />
                        <span>{copy.walkingToStopLabel}</span>
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {walkingSummary.distanceMeters >= 1000
                          ? `${(walkingSummary.distanceMeters / 1000).toFixed(1)} ${copy.kmShort}`
                          : `${walkingSummary.distanceMeters} ${copy.mShort}`}{' '}
                        · {Math.max(1, Math.round(walkingSummary.durationSeconds / 60))} {copy.minShort}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <dl className="divide-y divide-slate-100 border-y border-slate-100 text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">{copy.zoneRuleLabel}</dt>
                  <dd className="font-semibold text-slate-900">
                    {copy.rules[selectedZone.ruleType]}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">{copy.zoneStatusLabel}</dt>
                  <dd className="font-semibold text-slate-900">
                    {copy.statuses[selectedZone.status]}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">{copy.allowedVehiclesLabel}</dt>
                  <dd className="font-medium text-slate-900">
                    {selectedZone.allowedVehicles
                      .map((v) => copy.vehicleLabels[v])
                      .join(' · ')}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">Typical Fare</dt>
                  <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                    {selectedZone.fareRange}
                  </dd>
                </div>
              </dl>

              <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
                <span>{selectedZone.landmarkTip}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{copy.noZonesBody}</p>
          )}
        </div>

        {/* Vehicle-by-Vehicle Boarding Advice */}
        <div className="lg:col-span-7 p-6 space-y-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck className="h-4 w-4 text-slate-700" aria-hidden="true" />
            <span>{copy.howToRideTitle}</span>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="flex items-start gap-3.5 pb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <BusFront className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{copy.jeepGuideTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {copy.jeepGuideBody}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Bus className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{copy.busGuideTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {copy.busGuideBody}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 pt-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CarTaxiFront className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{copy.taxiGuideTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {copy.taxiGuideBody}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
