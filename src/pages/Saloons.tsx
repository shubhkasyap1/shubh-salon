import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Star, Clock, Search, Filter, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Saloon {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  address: string;
  city: string;
  state: string;
  rating: number;
  images: string[];
  opening_time: string;
  closing_time: string;
  latitude?: number | null;
  longitude?: number | null;
  _distanceKm?: number;
}

const POPULAR_CITIES = ["Delhi", "Bengaluru", "Mumbai", "Pune", "Dehradun"];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const Saloons = () => {
  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [filteredSaloons, setFilteredSaloons] = useState<Saloon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [cities, setCities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const { toast } = useToast();

  useEffect(() => {
    fetchSaloons();
  }, []);

  useEffect(() => {
    filterSaloons();
  }, [searchQuery, selectedCity, saloons, userLoc]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported by your browser", variant: "destructive" });
      return;
    }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => {
        setLocStatus("denied");
        toast({ title: "Location access denied", description: "Showing all salons instead.", variant: "destructive" });
      },
      { timeout: 8000 }
    );
  };

  // Auto-request on mount
  useEffect(() => {
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSaloons = async () => {
    try {
      const { data, error } = await supabase
        .from("saloons")
        .select("*")
        .eq("is_active", true)
        .order("rating", { ascending: false });

      if (error) throw error;
      setSaloons(data || []);
      setFilteredSaloons(data || []);
      
      // Extract unique cities
      const uniqueCities = [...new Set((data || []).map(s => s.city))].sort();
      setCities(uniqueCities);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error loading salons",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterSaloons = () => {
    let filtered = saloons.map((s) => {
      if (userLoc && s.latitude != null && s.longitude != null) {
        return { ...s, _distanceKm: haversineKm(userLoc, { lat: Number(s.latitude), lng: Number(s.longitude) }) };
      }
      return { ...s };
    });

    // Filter by city
    if (selectedCity && selectedCity !== "all") {
      filtered = filtered.filter(s => s.city === selectedCity);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (saloon) =>
          saloon.name.toLowerCase().includes(query) ||
          saloon.city.toLowerCase().includes(query) ||
          saloon.state.toLowerCase().includes(query) ||
          saloon.address.toLowerCase().includes(query)
      );
    }

    // Distance sort when known
    if (userLoc) {
      filtered.sort((a, b) => {
        const da = a._distanceKm ?? Infinity;
        const db = b._distanceKm ?? Infinity;
        return da - db;
      });
    }

    setFilteredSaloons(filtered);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Discover <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Premium Salons</span>
          </h1>
          <p className="text-muted-foreground text-lg">Find the perfect salon for your grooming needs</p>
        </div>

        {/* Popular city chips */}
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground mr-1">Popular:</span>
          <Button
            variant={selectedCity === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCity("all")}
          >All</Button>
          {POPULAR_CITIES.map((c) => (
            <Button
              key={c}
              variant={selectedCity === c ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCity(c)}
            >{c}</Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={detectLocation}
            disabled={locStatus === "loading"}
          >
            <Navigation className="w-4 h-4 mr-1" />
            {locStatus === "granted" ? "Using your location" : locStatus === "loading" ? "Locating…" : "Find near me"}
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by salon name, city, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 items-center">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-48 bg-muted" />
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : filteredSaloons.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              {searchQuery ? "No salons found matching your search." : "No salons available yet."}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSaloons.map((saloon) => (
              <Link key={saloon.id} to={`/saloons/${saloon.slug || saloon.id}`}>
                <Card className="overflow-hidden hover:shadow-elevated transition-all duration-300 h-full group">
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
                    {saloon.images && saloon.images.length > 0 ? (
                      <img
                        src={saloon.images[0]}
                        alt={saloon.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No Image
                      </div>
                    )}
                    <Badge className="absolute top-3 right-3 bg-white/90 text-primary hover:bg-white">
                      <Star className="w-3 h-3 mr-1 fill-primary" />
                      {saloon.rating.toFixed(1)}
                    </Badge>
                    {saloon._distanceKm != null && (
                      <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                        <MapPin className="w-3 h-3 mr-1" />
                        {saloon._distanceKm < 1 ? `${Math.round(saloon._distanceKm * 1000)} m` : `${saloon._distanceKm.toFixed(1)} km`}
                      </Badge>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {saloon.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">{saloon.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{saloon.address}, {saloon.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{saloon.opening_time} - {saloon.closing_time}</span>
                    </div>
                    <Button className="w-full mt-4 gradient-saffron">
                      View Details & Book
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Saloons;
