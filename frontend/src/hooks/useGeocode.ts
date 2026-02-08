import { useState, useEffect, useRef, useCallback } from 'react';
import type { PafAddressResult, LocationResult } from '@/types';

export interface GeocodedPin {
  lat: number;
  lng: number;
  label: string;
  source: 'paf' | 'aws';
}

interface GeocodeCache {
  [address: string]: { lat: number; lng: number } | null;
}

const cache: GeocodeCache = {};

function cleanAddress(address: string): string {
  // Remove country suffix (AUS, Australia) and strip commas for better Nominatim results
  return address
    .replace(/,?\s*\bAUS\b$/i, '')
    .replace(/,?\s*\bAustralia\b$/i, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (cache[address] !== undefined) return cache[address];

  const cleaned = cleanAddress(address);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=au&limit=1&q=${encodeURIComponent(cleaned)}`,
      { headers: { 'User-Agent': 'RapidAddressServicePOC/1.0' } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      cache[address] = result;
      return result;
    }
    cache[address] = null;
    return null;
  } catch {
    return null;
  }
}

export function useGeocode(
  pafResults: PafAddressResult[] | undefined,
  awsResults: LocationResult[] | undefined
) {
  const [pins, setPins] = useState<GeocodedPin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef(0);

  const geocodeAll = useCallback(async (
    pafSlice: PafAddressResult[],
    awsSlice: LocationResult[],
    requestId: number,
  ) => {
    const results: GeocodedPin[] = [];

    // Geocode AWS first - they're more location-relevant to the search query
    for (const result of awsSlice) {
      if (abortRef.current !== requestId) return;
      const wasCached = cache[result.text] !== undefined;
      const coords = await geocodeAddress(result.text);
      if (coords) {
        results.push({ ...coords, label: result.text, source: 'aws' });
      }
      if (!wasCached) await new Promise((r) => setTimeout(r, 1100));
    }

    // Update pins after AWS geocoding so map zooms to the relevant area
    if (abortRef.current === requestId && results.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPins([...results]);
    }

    // Then geocode PAF results
    for (const result of pafSlice) {
      if (abortRef.current !== requestId) return;
      const wasCached = cache[result.address] !== undefined;
      const coords = await geocodeAddress(result.address);
      if (coords) {
        results.push({ ...coords, label: result.addressShort || result.address, source: 'paf' });
      }
      if (!wasCached) await new Promise((r) => setTimeout(r, 1100));
    }

    if (abortRef.current === requestId) {
      setPins([...results]);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const allPaf = pafResults ?? [];
    const allAws = awsResults ?? [];

    if (allPaf.length === 0 && allAws.length === 0) {
      setPins([]);
      return;
    }

    const requestId = ++abortRef.current;
    setIsLoading(true);

    geocodeAll(allPaf.slice(0, 5), allAws.slice(0, 5), requestId);
  }, [pafResults, awsResults, geocodeAll]);

  return { pins, isLoading };
}
