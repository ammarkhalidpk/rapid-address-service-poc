import { useState, useEffect, useRef } from 'react';
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

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (cache[address] !== undefined) return cache[address];

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&countrycodes=au&limit=1&q=${encodeURIComponent(address)}`,
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

  useEffect(() => {
    const allPaf = pafResults ?? [];
    const allAws = awsResults ?? [];

    if (allPaf.length === 0 && allAws.length === 0) {
      setPins([]);
      return;
    }

    const requestId = ++abortRef.current;
    setIsLoading(true);

    async function run() {
      const results: GeocodedPin[] = [];

      // Geocode top 5 from each source (Nominatim rate limit: 1 req/sec)
      const pafSlice = allPaf.slice(0, 5);
      const awsSlice = allAws.slice(0, 5);

      for (const result of pafSlice) {
        if (abortRef.current !== requestId) return;
        const coords = await geocodeAddress(result.address);
        if (coords) {
          results.push({ ...coords, label: result.addressShort || result.address, source: 'paf' });
        }
        // Respect Nominatim rate limit unless cached
        if (!cache[result.address]) await new Promise((r) => setTimeout(r, 1100));
      }

      for (const result of awsSlice) {
        if (abortRef.current !== requestId) return;
        const coords = await geocodeAddress(result.text);
        if (coords) {
          results.push({ ...coords, label: result.text, source: 'aws' });
        }
        if (!cache[result.text]) await new Promise((r) => setTimeout(r, 1100));
      }

      if (abortRef.current === requestId) {
        setPins(results);
        setIsLoading(false);
      }
    }

    run();
  }, [pafResults, awsResults]);

  return { pins, isLoading };
}
