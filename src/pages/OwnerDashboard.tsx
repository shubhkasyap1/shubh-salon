import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { BarberManagement } from "@/components/BarberManagement";
import { RevenueAnalytics } from "@/components/RevenueAnalytics";
import { BookingCalendar } from "@/components/BookingCalendar";
import { ImageUpload } from "@/components/ImageUpload";
import { SaloonScheduleSettings } from "@/components/SaloonScheduleSettings";
import { SaloonReviews } from "@/components/SaloonReviews";
import { SaloonBilling } from "@/components/SaloonBilling";
import { LocationPicker } from "@/components/LocationPicker";
import { OwnerKycSection } from "@/components/OwnerKycSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Store, IndianRupee, Users, Check, X, Scissors, TrendingUp, Phone, MapPin, Edit, Trash2, User, Star, CalendarDays, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Saloon {
  id: string;
  name: string;
  slug?: string | null;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  images: string[];
  weekly_off_day: number | null;
  closed_dates: string[];
  opening_time: string;
  closing_time: string;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  gst_number: string | null;
  pan_number: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Booking {
  id: string;
  booking_date: string;
  time_slot: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  payment_status: string;
  payment_method: string;
  total_price: number;
  user_id: string;
  customer_phone: string | null;
  customer_address: string | null;
  selected_services: unknown;
  services: { name: string };
  barbers: { name: string } | null;
  profiles: { name: string; phone: string | null } | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string;
  category: string;
}

// Helper to safely get selected services names
const getSelectedServicesNames = (selected_services: unknown, fallbackName?: string): string => {
  try {
    let services = selected_services;
    if (typeof services === 'string') {
      services = JSON.parse(services);
    }
    if (Array.isArray(services) && services.length > 0) {
      return services.map((s: { name: string }) => s.name).join(", ");
    }
  } catch {
    // Fall through to fallback
  }
  return fallbackName || "Service";
};

const OwnerDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [selectedSaloon, setSelectedSaloon] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSaloon, setIsCreatingSaloon] = useState(false);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [editingSaloon, setEditingSaloon] = useState<Saloon | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [saloonForm, setSaloonForm] = useState({
    name: "",
    slug: "",
    description: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    images: [] as string[],
    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    gst_number: "",
    pan_number: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [serviceForm, setServiceForm] = useState({
    name: "",
    price: "",
    duration_minutes: "30",
    description: "",
    category: "General",
  });

  useEffect(() => {
    if (user) {
      fetchSaloons();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSaloon) {
      fetchBookings();
      fetchServices();
    }
  }, [selectedSaloon, calendarDate]);

  const fetchSaloons = async () => {
    try {
      const { data, error } = await supabase
        .from("saloons")
        .select("*")
        .eq("owner_id", user?.id);

      if (error) throw error;
      setSaloons(data || []);
      if (data && data.length > 0) {
        setSelectedSaloon(data[0].id);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error loading salons", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services (name),
          barbers (name)
        `)
        .eq("saloon_id", selectedSaloon)
        .order("booking_date", { ascending: false });

      if (error) throw error;
      
      // Fetch customer profiles separately
      const userIds = [...new Set((data || []).map(b => b.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, phone")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const bookingsWithProfiles = (data || []).map(booking => ({
        ...booking,
        profiles: profileMap.get(booking.user_id) || null,
      }));
      
      setBookings(bookingsWithProfiles as Booking[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error loading bookings", description: message, variant: "destructive" });
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("saloon_id", selectedSaloon)
        .order("price");

      if (error) throw error;
      setServices(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error loading services", description: message, variant: "destructive" });
    }
  };

  const validateSaloonForm = () => {
    if (!saloonForm.name.trim()) {
      toast({ title: "Salon name is required", variant: "destructive" });
      return false;
    }
    if (!saloonForm.address.trim()) {
      toast({ title: "Address is required", variant: "destructive" });
      return false;
    }
    if (!saloonForm.city.trim()) {
      toast({ title: "City is required", variant: "destructive" });
      return false;
    }
    if (!saloonForm.state.trim()) {
      toast({ title: "State is required", variant: "destructive" });
      return false;
    }
    if (!/^\d{6}$/.test(saloonForm.pincode)) {
      toast({ title: "Pincode must be 6 digits", variant: "destructive" });
      return false;
    }
    return true;
  };

  const createSaloon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSaloonForm()) return;
    
    setIsCreatingSaloon(true);
    try {
      const baseSlug = saloonForm.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "saloon";
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("saloons").insert({
        ...saloonForm,
        slug,
        owner_id: user?.id,
      });

      if (error) throw error;
      toast({ title: "Salon created!", description: "Your salon has been added successfully" });
      setSaloonForm({ name: "", slug: "", description: "", address: "", city: "", state: "", pincode: "", phone: "", images: [], bank_account_name: "", bank_account_number: "", bank_ifsc_code: "", bank_name: "", gst_number: "", pan_number: "", latitude: null, longitude: null });
      fetchSaloons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error creating salon", description: message, variant: "destructive" });
    } finally {
      setIsCreatingSaloon(false);
    }
  };

  const updateSaloon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSaloon || !validateSaloonForm()) return;

    try {
      const { error } = await supabase
        .from("saloons")
        .update({
          name: saloonForm.name,
          slug: saloonForm.slug || undefined,
          description: saloonForm.description,
          address: saloonForm.address,
          city: saloonForm.city,
          state: saloonForm.state,
          pincode: saloonForm.pincode,
          phone: saloonForm.phone,
          images: saloonForm.images,
          bank_account_name: saloonForm.bank_account_name || null,
          bank_account_number: saloonForm.bank_account_number || null,
          bank_ifsc_code: saloonForm.bank_ifsc_code || null,
          bank_name: saloonForm.bank_name || null,
          gst_number: saloonForm.gst_number || null,
          pan_number: saloonForm.pan_number || null,
          latitude: saloonForm.latitude,
          longitude: saloonForm.longitude,
        })
        .eq("id", editingSaloon.id);

      if (error) throw error;
      toast({ title: "Salon updated!" });
      setIsEditDialogOpen(false);
      setEditingSaloon(null);
      fetchSaloons();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error updating salon", description: message, variant: "destructive" });
    }
  };

  const deleteSaloon = async (saloonId: string) => {
    try {
      const { error } = await supabase
        .from("saloons")
        .delete()
        .eq("id", saloonId);

      if (error) throw error;
      toast({ title: "Salon deleted" });
      fetchSaloons();
      if (selectedSaloon === saloonId) {
        setSelectedSaloon(null);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error deleting salon", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (saloon: Saloon) => {
    setEditingSaloon(saloon);
    setSaloonForm({
      name: saloon.name,
      slug: saloon.slug || "",
      description: saloon.description || "",
      address: saloon.address,
      city: saloon.city,
      state: saloon.state,
      pincode: saloon.pincode,
      phone: saloon.phone || "",
      images: saloon.images || [],
      bank_account_name: saloon.bank_account_name || "",
      bank_account_number: saloon.bank_account_number || "",
      bank_ifsc_code: saloon.bank_ifsc_code || "",
      bank_name: saloon.bank_name || "",
      gst_number: saloon.gst_number || "",
      pan_number: saloon.pan_number || "",
      latitude: saloon.latitude ?? null,
      longitude: saloon.longitude ?? null,
    });
    setIsEditDialogOpen(true);
  };

  const validateServiceForm = () => {
    if (!serviceForm.name.trim()) {
      toast({ title: "Service name is required", variant: "destructive" });
      return false;
    }
    const price = parseFloat(serviceForm.price);
    if (isNaN(price) || price <= 0) {
      toast({ title: "Price must be greater than 0", variant: "destructive" });
      return false;
    }
    return true;
  };

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaloon || !validateServiceForm()) return;

    setIsCreatingService(true);
    try {
      const { error } = await supabase.from("services").insert({
        name: serviceForm.name.trim(),
        description: serviceForm.description?.trim() || null,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration_minutes),
        saloon_id: selectedSaloon,
        category: serviceForm.category,
      });

      if (error) throw error;
      toast({ title: "Service added!" });
      setServiceForm({ name: "", price: "", duration_minutes: "30", description: "", category: "General" });
      fetchServices();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error creating service", description: message, variant: "destructive" });
    } finally {
      setIsCreatingService(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status })
        .eq("id", bookingId);

      if (error) throw error;
      toast({ title: "Booking updated", description: `Booking ${status}` });

      // Fire status email (best-effort)
      const evt = status === "confirmed" ? "booking_confirmed" : status === "completed" ? "booking_completed" : status === "cancelled" ? "booking_cancelled" : null;
      if (evt) {
        supabase.functions.invoke("send-booking-status-email", { body: { bookingId, event: evt } }).catch(() => {});
        supabase.functions.invoke("send-whatsapp", { body: { bookingId, event: evt } }).catch(() => {});
      }

      fetchBookings();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error updating booking", description: message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  const selectedSaloonData = saloons.find((s) => s.id === selectedSaloon);

  const SaloonFormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Salon Name</Label>
        <Input id="name" value={saloonForm.name} onChange={(e) => setSaloonForm({ ...saloonForm, name: e.target.value })} required />
      </div>
      {isEdit && (
        <div>
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            value={saloonForm.slug}
            onChange={(e) =>
              setSaloonForm({
                ...saloonForm,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
              })
            }
            placeholder="e.g. glow-studio-delhi"
          />
          <p className="text-xs text-muted-foreground mt-1">Appears in your public link: /saloons/{saloonForm.slug || "your-slug"}</p>
        </div>
      )}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={saloonForm.description} onChange={(e) => setSaloonForm({ ...saloonForm, description: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Input id="address" value={saloonForm.address} onChange={(e) => setSaloonForm({ ...saloonForm, address: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" value={saloonForm.city} onChange={(e) => setSaloonForm({ ...saloonForm, city: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="state">State</Label>
          <Input id="state" value={saloonForm.state} onChange={(e) => setSaloonForm({ ...saloonForm, state: e.target.value })} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pincode">Pincode</Label>
          <Input id="pincode" value={saloonForm.pincode} onChange={(e) => setSaloonForm({ ...saloonForm, pincode: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={saloonForm.phone} onChange={(e) => setSaloonForm({ ...saloonForm, phone: e.target.value })} />
        </div>
      </div>
      
      {/* Images Section */}
      <div>
        <Label>Salon Images</Label>
        <ImageUpload
          bucket="saloon-images"
          images={saloonForm.images}
          onImagesChange={(images) => setSaloonForm({ ...saloonForm, images })}
          maxImages={5}
        />
      </div>

      {/* Map Pin */}
      <div className="border-t pt-4 mt-4">
        <LocationPicker
          latitude={saloonForm.latitude}
          longitude={saloonForm.longitude}
          onChange={(lat, lng) => setSaloonForm({ ...saloonForm, latitude: lat, longitude: lng })}
        />
      </div>

      {/* Bank Details Section */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-semibold mb-4">Bank Details (for online payments)</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input id="bank_name" value={saloonForm.bank_name} onChange={(e) => setSaloonForm({ ...saloonForm, bank_name: e.target.value })} placeholder="e.g., State Bank of India" />
            </div>
            <div>
              <Label htmlFor="bank_account_name">Account Holder Name</Label>
              <Input id="bank_account_name" value={saloonForm.bank_account_name} onChange={(e) => setSaloonForm({ ...saloonForm, bank_account_name: e.target.value })} placeholder="Name as per bank account" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input id="bank_account_number" value={saloonForm.bank_account_number} onChange={(e) => setSaloonForm({ ...saloonForm, bank_account_number: e.target.value })} placeholder="Account number" />
            </div>
            <div>
              <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
              <Input id="bank_ifsc_code" value={saloonForm.bank_ifsc_code} onChange={(e) => setSaloonForm({ ...saloonForm, bank_ifsc_code: e.target.value.toUpperCase() })} placeholder="e.g., SBIN0001234" />
            </div>
          </div>
        </div>
      </div>

      {/* Tax Details Section */}
      <div className="border-t pt-4 mt-4">
        <h4 className="font-semibold mb-4">Tax Details</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="gst_number">GST Number (Optional)</Label>
            <Input id="gst_number" value={saloonForm.gst_number} onChange={(e) => setSaloonForm({ ...saloonForm, gst_number: e.target.value.toUpperCase() })} placeholder="e.g., 22AAAAA0000A1Z5" />
          </div>
          <div>
            <Label htmlFor="pan_number">PAN Number (Optional)</Label>
            <Input id="pan_number" value={saloonForm.pan_number} onChange={(e) => setSaloonForm({ ...saloonForm, pan_number: e.target.value.toUpperCase() })} placeholder="e.g., ABCDE1234F" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              Owner <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Dashboard</span>
            </h1>
            <p className="text-muted-foreground text-lg">Manage your salons, barbers, and bookings</p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="gradient-saffron">
                <Store className="w-4 h-4 mr-2" />
                Add Salon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Salon</DialogTitle>
                <DialogDescription>Add your salon details</DialogDescription>
              </DialogHeader>
              <form onSubmit={createSaloon}>
                <SaloonFormFields />
                <Button type="submit" className="w-full gradient-saffron mt-4" disabled={isCreatingSaloon}>
                  {isCreatingSaloon ? "Creating..." : "Create Salon"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {saloons.length === 0 ? (
          <Card className="p-12 text-center">
            <Store className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">You haven't created any salons yet</p>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gradient-saffron">Create Your First Salon</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Salon</DialogTitle>
                  <DialogDescription>Add your salon details</DialogDescription>
                </DialogHeader>
                <form onSubmit={createSaloon}>
                  <SaloonFormFields />
                  <Button type="submit" className="w-full gradient-saffron mt-4" disabled={isCreatingSaloon}>
                    {isCreatingSaloon ? "Creating..." : "Create Salon"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </Card>
        ) : (
          <>
            {/* Salon Selection with Edit/Delete */}
            <div className="mb-6 flex items-end gap-4">
              <div className="flex-1">
                <Label>Select Salon</Label>
                <select
                  className="w-full max-w-md mt-2 p-2 border rounded-md bg-background"
                  value={selectedSaloon || ""}
                  onChange={(e) => setSelectedSaloon(e.target.value)}
                >
                  {saloons.map((saloon) => (
                    <option key={saloon.id} value={saloon.id}>{saloon.name}</option>
                  ))}
                </select>
              </div>
              {selectedSaloonData && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(selectedSaloonData)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Salon?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{selectedSaloonData.name}" and all associated data including bookings, services, and barbers. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSaloon(selectedSaloonData.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            {/* Edit Salon Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Salon</DialogTitle>
                  <DialogDescription>Update your salon details</DialogDescription>
                </DialogHeader>
                <form onSubmit={updateSaloon}>
                  <SaloonFormFields isEdit />
                  <Button type="submit" className="w-full gradient-saffron mt-4">
                    Update Salon
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Tabs defaultValue="bookings" className="w-full">
              <TabsList className="grid w-full max-w-3xl grid-cols-7">
                <TabsTrigger value="bookings">
                  <Users className="w-4 h-4 mr-2" />
                  Bookings
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="schedule">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="services">
                  <IndianRupee className="w-4 h-4 mr-2" />
                  Services
                </TabsTrigger>
                <TabsTrigger value="barbers">
                  <Scissors className="w-4 h-4 mr-2" />
                  Barbers
                </TabsTrigger>
                <TabsTrigger value="reviews">
                  <Star className="w-4 h-4 mr-2" />
                  Reviews
                </TabsTrigger>
                <TabsTrigger value="billing">
                  <FileText className="w-4 h-4 mr-2" />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="analytics">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="kyc">
                  <FileText className="w-4 h-4 mr-2" />
                  KYC
                </TabsTrigger>
              </TabsList>

              {/* Bookings Tab */}
              <TabsContent value="bookings" className="mt-6">
                <div className="grid gap-4">
                  {bookings.length === 0 ? (
                    <Card className="p-12 text-center">
                      <p className="text-muted-foreground">No bookings yet</p>
                    </Card>
                  ) : (
                    bookings.map((booking) => (
                      <Card key={booking.id} className="shadow-card">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {booking.profiles?.name || "Customer"}
                              </h3>
                              <div className="flex gap-2 mt-1">
                                <Badge className={booking.status === "confirmed" ? "bg-secondary" : ""}>
                                  {booking.status}
                                </Badge>
                                <Badge variant={booking.payment_method === "cash" ? "outline" : "default"}>
                                  {booking.payment_method === "cash" ? "Cash" : "Paid Online"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <p><strong>Service:</strong> {getSelectedServicesNames(booking.selected_services, booking.services?.name)}</p>
                            {booking.barbers && (
                              <p><strong>Barber:</strong> {booking.barbers.name}</p>
                            )}
                            <p><strong>Date:</strong> {format(new Date(booking.booking_date), "PPP")}</p>
                            <p><strong>Time:</strong> {booking.time_slot}</p>
                            {(booking.profiles?.phone || booking.customer_phone) && (
                              <p className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                {booking.profiles?.phone || booking.customer_phone}
                              </p>
                            )}
                            {booking.customer_address && (
                              <p className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                {booking.customer_address}
                              </p>
                            )}
                            <p className="flex items-center">
                              <strong className="mr-2">Amount:</strong>
                              <IndianRupee className="w-4 h-4" />
                              {booking.total_price}
                            </p>
                          </div>
                          {booking.status === "pending" && (
                            <div className="flex gap-2 mt-4">
                              <Button
                                className="flex-1 bg-secondary hover:bg-secondary/90"
                                onClick={() => updateBookingStatus(booking.id, "confirmed")}
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Confirm
                              </Button>
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={() => updateBookingStatus(booking.id, "cancelled")}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {booking.status === "confirmed" && (
                            <Button
                              className="w-full mt-4 gradient-saffron"
                              onClick={() => updateBookingStatus(booking.id, "completed")}
                            >
                              Mark as Completed
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Calendar Tab */}
              <TabsContent value="calendar" className="mt-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  <BookingCalendar
                    saloonId={selectedSaloon!}
                    selectedDate={calendarDate}
                    onDateSelect={setCalendarDate}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Bookings for {format(calendarDate, "PPP")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bookings
                        .filter((b) => b.booking_date === format(calendarDate, "yyyy-MM-dd"))
                        .length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No bookings for this date</p>
                      ) : (
                        <div className="space-y-3">
                          {bookings
                            .filter((b) => b.booking_date === format(calendarDate, "yyyy-MM-dd"))
                            .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
                            .map((booking) => (
                              <div key={booking.id} className="p-3 border rounded-lg">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <span className="font-medium">{booking.time_slot}</span>
                                    <span className="ml-2 text-sm text-muted-foreground">
                                      - {booking.profiles?.name || "Customer"}
                                    </span>
                                  </div>
                                  <Badge>{booking.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {getSelectedServicesNames(booking.selected_services, booking.services?.name)}
                                </p>
                                {(booking.profiles?.phone || booking.customer_phone) && (
                                  <p className="text-sm text-muted-foreground">{booking.profiles?.phone || booking.customer_phone}</p>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="mt-6">
                {selectedSaloon && selectedSaloonData && (
                  <SaloonScheduleSettings
                    saloonId={selectedSaloon}
                    weeklyOffDay={selectedSaloonData.weekly_off_day}
                    closedDates={selectedSaloonData.closed_dates || []}
                    openingTime={selectedSaloonData.opening_time}
                    closingTime={selectedSaloonData.closing_time}
                    onUpdate={fetchSaloons}
                  />
                )}
              </TabsContent>

              <TabsContent value="services" className="mt-6">
                <div className="mb-6">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="gradient-saffron">Add Service</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Service</DialogTitle>
                        <DialogDescription>Create a new service for your salon</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={createService} className="space-y-4">
                        <div>
                          <Label htmlFor="service-name">Service Name</Label>
                          <Input id="service-name" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required />
                        </div>
                        <div>
                          <Label htmlFor="service-category">Category</Label>
                          <select
                            id="service-category"
                            className="w-full p-2 border rounded-md bg-background"
                            value={serviceForm.category}
                            onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                          >
                            <option value="General">General</option>
                            <option value="Haircut">Haircut</option>
                            <option value="Shaving">Shaving</option>
                            <option value="Beard">Beard</option>
                            <option value="Facial">Facial</option>
                            <option value="Hair Coloring">Hair Coloring</option>
                            <option value="Massage">Massage</option>
                            <option value="Spa">Spa</option>
                            <option value="Kids">Kids</option>
                            <option value="Package">Package</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="service-description">Description</Label>
                          <Textarea id="service-description" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="price">Price (₹)</Label>
                            <Input id="price" type="number" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} required />
                          </div>
                          <div>
                            <Label htmlFor="duration">Duration (min)</Label>
                            <Input id="duration" type="number" value={serviceForm.duration_minutes} onChange={(e) => setServiceForm({ ...serviceForm, duration_minutes: e.target.value })} required />
                          </div>
                        </div>
                        <Button type="submit" className="w-full gradient-saffron" disabled={isCreatingService}>
                          {isCreatingService ? "Adding..." : "Add Service"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {services.length === 0 ? (
                    <Card className="p-12 text-center md:col-span-2 lg:col-span-3">
                      <p className="text-muted-foreground">No services added yet</p>
                    </Card>
                  ) : (
                    services.map((service) => (
                      <Card key={service.id} className="shadow-card">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle>{service.name}</CardTitle>
                              <CardDescription>{service.description}</CardDescription>
                            </div>
                            <Badge>{service.category || 'General'}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center font-bold text-xl">
                              <IndianRupee className="w-5 h-5" />
                              {service.price}
                            </div>
                            <Badge variant="outline">{service.duration_minutes} min</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Barbers Tab */}
              <TabsContent value="barbers" className="mt-6">
                {selectedSaloon && <BarberManagement saloonId={selectedSaloon} />}
              </TabsContent>

              {/* Reviews Tab */}
              <TabsContent value="reviews" className="mt-6">
                {selectedSaloon && <SaloonReviews saloonId={selectedSaloon} showUserNames={false} showIndividualRatings={false} />}
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing" className="mt-6">
                {selectedSaloon && <SaloonBilling saloonId={selectedSaloon} />}
              </TabsContent>

              {/* Analytics Tab */}
              <TabsContent value="analytics" className="mt-6">
                {selectedSaloon && <RevenueAnalytics saloonId={selectedSaloon} />}
              </TabsContent>

              <TabsContent value="kyc" className="mt-6">
                {selectedSaloon && <OwnerKycSection saloonId={selectedSaloon} />}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
