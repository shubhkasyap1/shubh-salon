import { Button } from "@/components/ui/button";
import { ExternalLink, MapPin } from "lucide-react";

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;

interface Props {
  latitude: number | null;
  longitude: number | null;
  name: string;
  address?: string;
}

export const SalonMap = ({ latitude, longitude, name, address }: Props) => {
  if (latitude == null || longitude == null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground flex items-center gap-2">
        <MapPin className="w-4 h-4" /> Location not pinned yet
      </div>
    );
  }
  const q = `${latitude},${longitude}`;
  const embedSrc = BROWSER_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${BROWSER_KEY}&q=${q}&zoom=16`
    : null;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return (
    <div className="rounded-lg overflow-hidden border">
      {embedSrc ? (
        <iframe
          title={`${name} location`}
          src={embedSrc}
          className="w-full h-64 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="w-full h-64 flex items-center justify-center bg-muted">
          <MapPin className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-between p-3 bg-card">
        <div className="text-sm">
          <div className="font-medium">{name}</div>
          {address && <div className="text-muted-foreground text-xs">{address}</div>}
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={openUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-1" /> Open in Maps
          </a>
        </Button>
      </div>
    </div>
  );
};