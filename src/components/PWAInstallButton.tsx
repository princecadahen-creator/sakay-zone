import React, {useState} from 'react';
import {Download, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Install SakayZone on Phone
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2 text-xs text-slate-600 leading-relaxed list-decimal pl-4">
                <li>
                  Tap the <span className="inline-flex items-center gap-1 font-semibold text-slate-900"><Share className="h-3 w-3" aria-hidden="true" /> Share</span> button in Safari.
                </li>
                <li>
                  Scroll down and tap <strong className="text-slate-900">Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong className="text-slate-900">Add</strong> — SakayZone will open as a full-screen mobile app.
                </li>
              </ol>
            ) : (
              <ol className="space-y-2 text-xs text-slate-600 leading-relaxed list-decimal pl-4">
                <li>
                  Open <strong className="text-slate-900">SakayZone</strong> in Chrome or Edge on your phone or laptop.
                </li>
                <li>
                  Tap the browser menu (<strong className="text-slate-900">⋮</strong>) → <strong className="text-slate-900">Install app</strong> or <strong className="text-slate-900">Add to Home screen</strong>.
                </li>
                <li>
                  It installs directly on your home screen with its own icon — no app store needed.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
