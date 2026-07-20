import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    google?: any;
    __gmapsLoading?: Promise<void>;
    __gmapsInit?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) return reject(new Error("Google Maps browser key missing"));
    window.__gmapsInit = () => resolve();
    const s = document.createElement("script");
    const channelParam = CHANNEL ? `&channel=${CHANNEL}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&libraries=places&loading=async&callback=__gmapsInit${channelParam}`;
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return window.__gmapsLoading;
}

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

export const LocationPicker = ({ latitude, longitude, onChange }: Props) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const mapInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const initLat = latitude ?? 28.6139; // Delhi default
        const initLng = longitude ?? 77.209;
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: initLat, lng: initLng },
          zoom: latitude ? 16 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const marker = new window.google.maps.Marker({
          position: { lat: initLat, lng: initLng },
          map,
          draggable: true,
        });
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          onChange(pos.lat(), pos.lng());
        });
        map.addListener("click", (e: any) => {
          marker.setPosition(e.latLng);
          onChange(e.latLng.lat(), e.latLng.lng());
        });
        mapInstance.current = map;
        markerRef.current = marker;
        setReady(true);
      })
      .catch((err) => {
        console.error("Maps load failed", err);
        toast({ title: "Map unavailable", description: err.message, variant: "destructive" });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external lat/lng changes
  useEffect(() => {
    if (!ready || latitude == null || longitude == null) return;
    const pos = { lat: latitude, lng: longitude };
    markerRef.current?.setPosition(pos);
    mapInstance.current?.panTo(pos);
  }, [latitude, longitude, ready]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        mapInstance.current?.setZoom(16);
      },
      (err) => toast({ title: "Location denied", description: err.message, variant: "destructive" })
    );
  };

  const searchPlace = async () => {
    if (!search.trim() || !window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: search }, (results: any[], status: string) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        onChange(loc.lat(), loc.lng());
        mapInstance.current?.setZoom(16);
      } else {
        toast({ title: "Place not found", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1">
          <MapPin className="w-4 h-4 text-primary" /> Pin Your Salon on Map
        </Label>
        <Button type="button" variant="ghost" size="sm" onClick={useMyLocation}>
          <Crosshair className="w-4 h-4 mr-1" /> Use my location
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Search a place or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              searchPlace();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={searchPlace}>Search</Button>
      </div>
      <div
        ref={mapRef}
        className="w-full h-64 rounded-md border bg-muted"
        aria-label="Salon location map"
      />
      {latitude != null && longitude != null && (
        <p className="text-xs text-muted-foreground">
          Pinned at {latitude.toFixed(5)}, {longitude.toFixed(5)} — drag the marker or tap on the map to adjust.
        </p>
      )}
    </div>
  );
};