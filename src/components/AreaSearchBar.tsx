import React, {useEffect, useRef, useState} from 'react';
import {MapPin, Search, X} from 'lucide-react';
import type {LatLngPoint} from '../types/transit';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

interface AreaSearchBarProps {
  placeholder: string;
  onAreaSelected: (location: LatLngPoint, label: string) => void;
}

export const AreaSearchBar: React.FC<AreaSearchBarProps> = ({placeholder, onAreaSelected}) => {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const query = inputValue.trim();
    if (query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&limit=6&q=${encodeURIComponent(
        query
      )}`;

      fetch(url, {
        headers: {'Accept-Language': 'en'},
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: NominatimResult[]) => {
          setResults(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [inputValue]);

  const handleSelectResult = (item: NominatimResult) => {
    const lat = Number.parseFloat(item.lat);
    const lng = Number.parseFloat(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const shortLabel = item.name || item.display_name.split(',')[0] || 'Selected Area';
    setInputValue(shortLabel);
    setIsOpen(false);
    setResults([]);
    onAreaSelected({lat, lng}, shortLabel);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={inputValue}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setResults([]);
            }}
            aria-label="Clear search"
            className="absolute right-2 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (results.length > 0 || isLoading) && (
        <div className="absolute left-0 right-0 top-full z-[1000] mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {isLoading && results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-500">Searching Philippines places...</div>
          ) : (
            <ul role="listbox" className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {results.map((item) => {
                const parts = item.display_name.split(',');
                const main = item.name || parts[0];
                const secondary = parts.slice(1, 4).join(',').trim();
                return (
                  <li key={item.place_id}>
                    <button
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">{main}</div>
                        {secondary && (
                          <div className="truncate text-xs text-slate-500">{secondary}</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
