import React, {useEffect, useState} from 'react';
import {WifiOff} from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-[1200] flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Offline / No-Data Mode — Saved Loading Zones, routes &amp; cached map tiles remain active.
      </span>
    </div>
  );
};
