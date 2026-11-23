import React, {useRef, useState} from 'react';
import {Download, Eye, EyeOff, MapPinPlus, Pencil, RotateCcw, Trash2, Upload} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {LoadingZone, VehicleType, ZoneRuleType, ZoneStatus} from '../types/transit';

interface ManageZonesPanelProps {
  zones: LoadingZone[];
  selectedZoneId: string | null;
  isPinMode: boolean;
  currentUid: string | null;
  copy: CopyDictionary;
  onTogglePinMode: () => void;
  onSelectZone: (zoneId: string) => void;
  onUpdateZone: (zoneId: string, patch: Partial<LoadingZone>) => void;
  onDeleteZone: (zoneId: string) => void;
  onImportZones: (imported: LoadingZone[]) => void;
  onResetCustomZones: () => void;
}

export const ManageZonesPanel: React.FC<ManageZonesPanelProps> = ({
  zones,
  selectedZoneId,
  isPinMode,
  currentUid,
  copy,
  onTogglePinMode,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onImportZones,
  onResetCustomZones,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRule, setDraftRule] = useState<ZoneRuleType>('loading_unloading');
  const [draftStatus, setDraftStatus] = useState<ZoneStatus>('active');
  const [draftTip, setDraftTip] = useState('');
  const [draftAllowed, setDraftAllowed] = useState<VehicleType[]>(['jeep', 'bus', 'taxi']);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (zone: LoadingZone) => {
    setEditingId(zone.id);
    setDraftName(zone.name);
    setDraftRule(zone.ruleType);
    setDraftStatus(zone.status);
    setDraftTip(zone.landmarkTip);
    setDraftAllowed(zone.allowedVehicles);
  };

  const toggleVehicleInDraft = (type: VehicleType) => {
    setDraftAllowed((prev) => {
      if (prev.includes(type)) {
        return prev.length > 1 ? prev.filter((t) => t !== type) : prev;
      }
      return [...prev, type];
    });
  };

  const handleSave = (zoneId: string) => {
    onUpdateZone(zoneId, {
      name: draftName.trim() || 'Loading Zone',
      ruleType: draftRule,
      status: draftStatus,
      landmarkTip: draftTip.trim() || 'Marked loading/unloading bay.',
      allowedVehicles: draftAllowed,
    });
    setEditingId(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(zones, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sakayzone-loading-zones.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        setImportFeedback('Invalid JSON format: expected an array of loading zones.');
        return;
      }
      const validZones: LoadingZone[] = parsed
        .filter(
          (item): item is LoadingZone =>
            Boolean(
              item &&
                typeof item === 'object' &&
                typeof (item as LoadingZone).id === 'string' &&
                typeof (item as LoadingZone).name === 'string' &&
                (item as LoadingZone).location &&
                typeof (item as LoadingZone).location.lat === 'number' &&
                typeof (item as LoadingZone).location.lng === 'number'
            )
        )
        .map((item) => ({
          ...item,
          source: 'custom',
        }));

      if (validZones.length === 0) {
        setImportFeedback('No valid loading zones found in the uploaded file.');
        return;
      }
      onImportZones(validZones);
      setImportFeedback(`Imported ${validZones.length} loading zones.`);
    } catch {
      setImportFeedback('Could not read JSON file. Check file syntax.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <section
      id="manage-stops"
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {copy.manageSectionTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            {copy.manageSectionSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTogglePinMode}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              isPinMode
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            <MapPinPlus className="h-4 w-4" aria-hidden="true" />
            <span>{isPinMode ? copy.pinModeOn : copy.pinModeOff}</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.exportConfig}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.importConfig}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={(e) => void handleImportFile(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={onResetCustomZones}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.resetCustom}</span>
          </button>
        </div>
      </div>

      {importFeedback && (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-medium text-slate-700">
          {importFeedback}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {zones.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {copy.noZonesBody}
          </div>
        ) : (
          zones.map((zone) => {
            const isEditing = editingId === zone.id;
            const isSelected = zone.id === selectedZoneId;
            const isOwner = Boolean(currentUid && zone.authorUid === currentUid);

            return (
              <div
                key={zone.id}
                className={`px-6 py-4 transition-colors ${
                  isSelected ? 'bg-slate-50/90' : 'bg-white'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {copy.zoneNameLabel}
                        </label>
                        <input
                          type="text"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {copy.zoneRuleLabel}
                        </label>
                        <select
                          value={draftRule}
                          onChange={(e) => setDraftRule(e.target.value as ZoneRuleType)}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        >
                          <option value="loading_unloading">{copy.rules.loading_unloading}</option>
                          <option value="loading_only">{copy.rules.loading_only}</option>
                          <option value="unloading_only">{copy.rules.unloading_only}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {copy.zoneStatusLabel}
                        </label>
                        <select
                          value={draftStatus}
                          onChange={(e) => setDraftStatus(e.target.value as ZoneStatus)}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        >
                          <option value="active">{copy.statuses.active}</option>
                          <option value="congested">{copy.statuses.congested}</option>
                          <option value="closed">{copy.statuses.closed}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {copy.zoneTipLabel}
                        </label>
                        <input
                          type="text"
                          value={draftTip}
                          onChange={(e) => setDraftTip(e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-slate-700 mb-1">
                          {copy.allowedVehiclesLabel}
                        </span>
                        <div className="flex items-center gap-2">
                          {(['jeep', 'bus', 'taxi'] as VehicleType[]).map((vType) => {
                            const active = draftAllowed.includes(vType);
                            return (
                              <button
                                key={vType}
                                type="button"
                                onClick={() => toggleVehicleInDraft(vType)}
                                className={`h-10 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                                  active
                                    ? 'border-slate-900 bg-slate-900 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {copy.vehicleLabels[vType]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        {copy.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSave(zone.id)}
                        className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {copy.saveZone}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => onSelectZone(zone.id)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-slate-900 rounded"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            zone.hidden ? 'text-slate-400 line-through' : 'text-slate-900'
                          }`}
                        >
                          {zone.name}
                        </span>
                        <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                        <span className="text-xs font-medium text-slate-600">
                          {copy.rules[zone.ruleType]}
                        </span>
                        <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                        <span
                          className={`text-xs font-semibold ${
                            zone.status === 'closed'
                              ? 'text-rose-700'
                              : zone.status === 'congested'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }`}
                        >
                          {copy.statuses[zone.status]}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {zone.allowedVehicles.map((v) => copy.vehicleLabels[v]).join(', ')} ·{' '}
                        {zone.address}
                        {zone.authorName ? ` · Shared by ${zone.authorName}` : ''}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateZone(zone.id, {hidden: !zone.hidden})}
                        title={zone.hidden ? copy.hiddenFromMap : copy.visibleOnMap}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {zone.hidden ? (
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{zone.hidden ? copy.hiddenFromMap : copy.visibleOnMap}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(zone)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      {zone.source === 'custom' && (!zone.authorUid || isOwner) && (
                        <button
                          type="button"
                          onClick={() => onDeleteZone(zone.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{copy.deleteZone}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
