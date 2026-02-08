import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin } from 'lucide-react';
import type { GeocodedPin } from '@/hooks/useGeocode';

// Fix Leaflet default marker icons (broken in bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const pafIcon = new L.DivIcon({
  html: `<div style="background:rgb(59,130,246);width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const awsIcon = new L.DivIcon({
  html: `<div style="background:rgb(249,115,22);width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface AddressMapProps {
  pins: GeocodedPin[];
  isLoading: boolean;
}

export function AddressMap({ pins, isLoading }: AddressMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current).setView([-25.2744, 133.7751], 4); // Australia center

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when pins change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    if (pins.length === 0) return;

    pins.forEach((pin) => {
      const icon = pin.source === 'paf' ? pafIcon : awsIcon;
      const sourceLabel = pin.source === 'paf' ? 'PAF' : 'AWS';

      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      marker.bindPopup(`<strong>${sourceLabel}</strong><br/>${pin.label}`);
    });

    // Prefer fitting to AWS pins (more location-relevant to search query),
    // fall back to all pins if no AWS results
    const awsPins = pins.filter((p) => p.source === 'aws');
    const fitPins = awsPins.length > 0 ? awsPins : pins;
    const bounds = L.latLngBounds(fitPins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [pins]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Address Locations
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white shadow-sm"></div>
            PAF
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-sm"></div>
            AWS
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-[400px] w-full rounded-md overflow-hidden" />
        {pins.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Search for addresses to see them on the map
          </p>
        )}
      </CardContent>
    </Card>
  );
}
