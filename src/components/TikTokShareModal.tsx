import React, {useEffect, useState} from 'react';
import {Check, Copy, Download, Share2, Video, X} from 'lucide-react';
import type {CopyDictionary} from '../i18n/translations';
import type {
  LoadingZone,
  MappedTransitRoute,
  TrackedVehicle,
  ZoneWeatherInfo,
} from '../types/transit';

interface TikTokShareModalProps {
  isOpen: boolean;
  areaLabel: string;
  selectedZone: LoadingZone | null;
  vehicles: TrackedVehicle[];
  mappedRoutes: MappedTransitRoute[];
  waitingCount: number;
  weather: ZoneWeatherInfo | null;
  copy: CopyDictionary;
  onClose: () => void;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function generateSummaryCardDataUrl(params: {
  areaLabel: string;
  selectedZone: LoadingZone | null;
  vehicles: TrackedVehicle[];
  mappedRoutes: MappedTransitRoute[];
  waitingCount: number;
  weather: ZoneWeatherInfo | null;
  copy: CopyDictionary;
}): string {
  const {areaLabel, selectedZone, vehicles, mappedRoutes, waitingCount, weather, copy} = params;
  const width = 1080;
  const height = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean high-contrast light editorial backdrop
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Top dark header band
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, 420);

  // Brand wordmark
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 54px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('SakayZone', 72, 118);

  // LIVE status pill (solid, crisp)
  drawRoundedRect(ctx, 780, 74, 228, 56, 12);
  ctx.fillStyle = '#059669';
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillText('● LIVE PH', 816, 111);

  // Area Headline
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 26px "DM Sans", system-ui, sans-serif';
  ctx.fillText('PHILIPPINE COMMUTER LOADING ZONE MONITOR', 72, 185);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 62px "Plus Jakarta Sans", system-ui, sans-serif';
  const areaLines = wrapTextLines(ctx, areaLabel, 936, 2);
  areaLines.forEach((line, idx) => {
    ctx.fillText(line, 72, 266 + idx * 74);
  });

  // Timestamp + Weather subtitle
  const nowStr = new Date().toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
  ctx.fillStyle = '#CBD5E1';
  ctx.font = '500 28px "DM Sans", system-ui, sans-serif';
  const weatherBit = weather
    ? `  ·  ${weather.temperatureC}°C ${weather.isRainy ? 'Rainy' : 'Clear'}`
    : '';
  ctx.fillText(`Snapshot at ${nowStr}${weatherBit}`, 72, 386);

  // Card 1: Selected Stop & Live "May Jeep Ba?" Verdict
  drawRoundedRect(ctx, 56, 464, 968, 370, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.stroke();

  const stopTitle = selectedZone ? selectedZone.name : `${areaLabel} Loading Zone`;
  const stopStatus = selectedZone ? copy.statuses[selectedZone.status] : copy.statuses.active;
  const stopRule = selectedZone
    ? copy.rules[selectedZone.ruleType]
    : copy.rules.loading_unloading;

  ctx.fillStyle = '#64748B';
  ctx.font = '700 24px "DM Sans", system-ui, sans-serif';
  ctx.fillText('SELECTED LOADING / UNLOADING ZONE', 96, 526);

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
  const stopLines = wrapTextLines(ctx, stopTitle, 880, 2);
  stopLines.forEach((line, idx) => {
    ctx.fillText(line, 96, 588 + idx * 54);
  });

  // Status & Queue Metrics Row
  const statusBg =
    selectedZone?.status === 'closed'
      ? '#FFE4E6'
      : selectedZone?.status === 'congested'
        ? '#FEF3C7'
        : '#D1FAE5';
  const statusFg =
    selectedZone?.status === 'closed'
      ? '#9F1239'
      : selectedZone?.status === 'congested'
        ? '#92400E'
        : '#065F46';

  drawRoundedRect(ctx, 96, 718, 320, 68, 14);
  ctx.fillStyle = statusBg;
  ctx.fill();
  ctx.fillStyle = statusFg;
  ctx.font = '700 26px "DM Sans", system-ui, sans-serif';
  ctx.fillText(stopStatus, 120, 761);

  drawRoundedRect(ctx, 438, 718, 280, 68, 14);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 26px "DM Sans", system-ui, sans-serif';
  ctx.fillText(`${waitingCount} ${copy.waitingHereSuffix}`, 464, 761);

  drawRoundedRect(ctx, 740, 718, 244, 68, 14);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
  ctx.fillText(stopRule.slice(0, 18), 762, 761);

  // Card 2: Live Incoming Vehicles / Radar Snapshot
  drawRoundedRect(ctx, 56, 868, 968, 570, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.stroke();

  const jeepCount = vehicles.filter((v) => v.type === 'jeep').length;
  const busCount = vehicles.filter((v) => v.type === 'bus').length;
  const taxiCount = vehicles.filter((v) => v.type === 'taxi').length;

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('LIVE APPROACHING RIDES', 96, 938);

  // 3 compact counters (Jeep, Bus, Taxi)
  const badges: Array<{label: string; count: number; color: string; x: number}> = [
    {label: 'Jeepneys', count: jeepCount, color: '#D97706', x: 96},
    {label: 'Buses', count: busCount, color: '#2563EB', x: 400},
    {label: 'Taxis', count: taxiCount, color: '#059669', x: 704},
  ];
  for (const b of badges) {
    drawRoundedRect(ctx, b.x, 974, 280, 118, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = b.color;
    ctx.font = '800 48px "JetBrains Mono", monospace';
    ctx.fillText(String(b.count), b.x + 28, 1040);

    ctx.fillStyle = '#475569';
    ctx.font = '700 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText(b.label, b.x + 28, 1076);
  }

  // Live vehicle rows or real mapped routes fallback
  const topVehicles = [...vehicles].sort((a, b) => a.etaSeconds - b.etaSeconds).slice(0, 3);
  if (topVehicles.length > 0) {
    topVehicles.forEach((veh, idx) => {
      const rowY = 1132 + idx * 96;
      drawRoundedRect(ctx, 96, rowY, 888, 80, 14);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();

      const tagColor =
        veh.type === 'jeep' ? '#D97706' : veh.type === 'bus' ? '#2563EB' : '#059669';
      drawRoundedRect(ctx, 114, rowY + 18, 112, 44, 10);
      ctx.fillStyle = tagColor;
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 22px "JetBrains Mono", monospace';
      ctx.fillText(veh.type.toUpperCase(), 132, rowY + 48);

      ctx.fillStyle = '#0F172A';
      ctx.font = '700 27px "DM Sans", system-ui, sans-serif';
      ctx.fillText(veh.routeLabel.slice(0, 32), 248, rowY + 50);

      const etaMins = Math.max(1, Math.round(veh.etaSeconds / 60));
      const etaLabel = veh.etaSeconds <= 35 ? 'NOW' : `${etaMins}m`;
      ctx.fillStyle = '#0F172A';
      ctx.font = '800 30px "JetBrains Mono", monospace';
      ctx.fillText(etaLabel, 878, rowY + 50);
    });
  } else if (mappedRoutes.length > 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '600 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText('REAL OPENSTREETMAP ROUTES PASSING HERE:', 96, 1152);

    mappedRoutes.slice(0, 3).forEach((rt, idx) => {
      const rowY = 1178 + idx * 80;
      drawRoundedRect(ctx, 96, rowY, 888, 66, 12);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.font = '700 24px "DM Sans", system-ui, sans-serif';
      ctx.fillText(`${rt.ref} · ${rt.name.slice(0, 42)}`, 122, rowY + 42);
    });
  } else {
    drawRoundedRect(ctx, 96, 1150, 888, 220, 18);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.font = '600 28px "DM Sans", system-ui, sans-serif';
    ctx.fillText('Open SakayZone to share live Jeepney GPS', 148, 1245);
    ctx.fillStyle = '#64748B';
    ctx.font = '500 25px "DM Sans", system-ui, sans-serif';
    ctx.fillText('or report incoming rides for fellow commuters!', 148, 1295);
  }

  // Bottom CTA / TikTok Link Card
  drawRoundedRect(ctx, 56, 1474, 968, 376, 28);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  ctx.fillStyle = '#F59E0B';
  ctx.font = '800 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('BAGO KA LANG SA LUGAR? CHECK THIS BEFORE BOARDING', 96, 1546);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 38px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Live Jeepney, Bus & Taxi Monitor (Buong PH)', 96, 1614);

  drawRoundedRect(ctx, 96, 1656, 888, 84, 16);
  ctx.fillStyle = '#1E293B';
  ctx.fill();
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 29px "JetBrains Mono", monospace';
  ctx.fillText('https://princecadahen-creator.github.io/sakay-zone/', 124, 1708);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 26px "DM Sans", system-ui, sans-serif';
  ctx.fillText('Created by Prince Cadahen · OpenStreetMap + Live GPS', 96, 1806);

  return canvas.toDataURL('image/png');
}

export const TikTokShareModal: React.FC<TikTokShareModalProps> = ({
  isOpen,
  areaLabel,
  selectedZone,
  vehicles,
  mappedRoutes,
  waitingCount,
  weather,
  copy,
  onClose,
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dataUrl = generateSummaryCardDataUrl({
      areaLabel,
      selectedZone,
      vehicles,
      mappedRoutes,
      waitingCount,
      weather,
      copy,
    });
    setImageUrl(dataUrl);
    setShareStatus(null);
  }, [isOpen, areaLabel, selectedZone, vehicles, mappedRoutes, waitingCount, weather, copy]);

  if (!isOpen) return null;

  const captionText = `SakayZone Live Check — ${areaLabel}${
    selectedZone ? ` (${selectedZone.name})` : ''
  }: ${vehicles.length} live rides tracked, ${waitingCount} ${
    copy.waitingHereSuffix
  }. Check live Jeepney, Bus & Taxi loading zones anywhere in the Philippines: https://princecadahen-creator.github.io/sakay-zone/ #SakayZone #CommuterPH #Jeepney`;

  const handleNativeShare = async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], 'sakayzone-live-status.png', {type: 'image/png'});
      const navWithShare = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (navWithShare.share && navWithShare.canShare?.({files: [file]})) {
        await navWithShare.share({
          title: `SakayZone Live — ${areaLabel}`,
          text: captionText,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({
          title: `SakayZone Live — ${areaLabel}`,
          text: captionText,
          url: 'https://princecadahen-creator.github.io/sakay-zone/',
        });
        return;
      }
    } catch {
      // Fall through cleanly to PNG download
    }

    // Fallback: trigger instant PNG download and inform user
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `sakayzone-${areaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    link.click();
    setShareStatus(copy.tiktokDownloadFallback);
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareStatus('Copy failed — you can select and copy the text manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-slate-900" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">{copy.tiktokModalTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600">{copy.tiktokModalSubtitle}</p>

          {imageUrl && (
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-100 p-3">
              <img
                src={imageUrl}
                alt={`SakayZone summary card for ${areaLabel}`}
                className="max-h-[360px] w-auto rounded-lg shadow-sm border border-slate-200"
              />
            </div>
          )}

          {shareStatus && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
              {shareStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => void handleNativeShare()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.tiktokShareAction}</span>
            </button>

            <a
              href={imageUrl}
              download={`sakayzone-${areaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.tiktokDownloadPng}</span>
            </a>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                TikTok Caption
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCaption()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden="true" />
                )}
                <span>{copied ? 'Copied' : 'Copy Caption'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed select-all">{captionText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
