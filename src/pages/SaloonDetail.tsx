import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useRazorpay } from "@/hooks/useRazorpay";
import { Header } from "@/components/layout/Header";
import { BookingCalendar } from "@/components/BookingCalendar";
import { SaloonReviews } from "@/components/SaloonReviews";
import { SalonMap } from "@/components/SalonMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Star, Clock, Phone, IndianRupee, User, Scissors, CreditCard, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, parse, isBefore } from "date-fns";
import { cn } from "@/lib/utils";

interface Saloon {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  rating: number;
  images: string[];
  opening_time: string;
  closing_time: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string;
  category: string;
}

interface Barber {
  id: string;
  name: string;
  phone: string;
  avatar_url: string;
  specialization: string;
}

const SaloonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isLoaded: razorpayLoaded } = useRazorpay();
  
  const [saloon, setSaloon] = useState<Saloon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cash">("online");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [isBooking, setIsBooking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchSaloonDetails();
    }
  }, [id]);

  useEffect(() => {
    if (saloon?.id) {
      fetchServices();
      fetchBarbers();
    }
  }, [saloon?.id]);

  useEffect(() => {
    if (saloon?.id && selectedDate) {
      fetchBookedSlots();
    }
  }, [saloon?.id, selectedDate]);

  const fetchSaloonDetails = async () => {
    try {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const column = uuidRe.test(id || "") ? "id" : "slug";
      const { data, error } = await supabase
        .from("saloons")
        .select("*")
        .eq(column, id!)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Salon not found");
      setSaloon(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error loading salon details",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("saloon_id", saloon!.id)
        .eq("is_active", true)
        .order("price");

      if (error) throw error;
      setServices(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error loading services",
        description: message,
        variant: "destructive",
      });
    }
  };

  const fetchBarbers = async () => {
    try {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("saloon_id", saloon!.id)
        .eq("is_active", true);

      if (error) throw error;
      setBarbers(data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error loading barbers",
        description: message,
        variant: "destructive",
      });
    }
  };

  const fetchBookedSlots = async () => {
    if (!selectedDate) return;
    
    const { data, error } = await supabase
      .from("bookings")
      .select("time_slot")
      .eq("saloon_id", saloon!.id)
      .eq("booking_date", format(selectedDate, "yyyy-MM-dd"))
      .neq("status", "cancelled");

    if (!error && data) {
      setBookedSlots(data.map((b) => b.time_slot));
      
      // Calculate slot counts
      const counts: Record<string, number> = {};
      data.forEach((b) => {
        counts[b.time_slot] = (counts[b.time_slot] || 0) + 1;
      });
      setSlotCounts(counts);
    }
  };

  const generateTimeSlots = () => {
    if (!saloon) return [];
    
    const slots: string[] = [];
    const [openHour, openMin] = saloon.opening_time.split(':').map(Number);
    const [closeHour, closeMin] = saloon.closing_time.split(':').map(Number);
    
    let currentHour = openHour;
    let currentMin = openMin;
    
    const now = new Date();
    const isSelectedToday = selectedDate && isToday(selectedDate);
    
    while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      // Only add slot if it's in the future for today
      if (isSelectedToday) {
        const slotTime = parse(timeString, 'HH:mm', new Date());
        if (!isBefore(slotTime, now)) {
          slots.push(timeString);
        }
      } else {
        slots.push(timeString);
      }
      
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
    
    return slots;
  };

  const toggleService = (service: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id);
      if (exists) {
        return prev.filter((s) => s.id !== service.id);
      }
      return [...prev, service];
    });
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);

  const validateForm = () => {
    if (selectedServices.length === 0) {
      toast({ title: "Please select at least one service", variant: "destructive" });
      return false;
    }
    if (!selectedDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return false;
    }
    if (!selectedTimeSlot) {
      toast({ title: "Please select a time slot", variant: "destructive" });
      return false;
    }
    if (!customerPhone.trim()) {
      toast({ title: "Please enter your mobile number", variant: "destructive" });
      return false;
    }
    if (!/^(\+91)?[6-9]\d{9}$/.test(customerPhone.replace(/\s/g, ""))) {
      toast({ title: "Please enter a valid mobile number", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleBooking = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to make a booking",
      });
      navigate("/auth");
      return;
    }

    if (!validateForm()) return;

    setIsBooking(true);

    try {
      const bookingPayload = {
        user_id: user.id,
        saloon_id: saloon!.id,
        service_id: selectedServices[0].id,
        barber_id: selectedBarber?.id || null,
        booking_date: format(selectedDate!, "yyyy-MM-dd"),
        time_slot: selectedTimeSlot,
        total_price: totalPrice,
        status: paymentMethod === "cash" ? "confirmed" : "pending",
        payment_status: paymentMethod === "cash" ? "completed" : "pending",
        payment_method: paymentMethod,
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim() || null,
        selected_services: selectedServices.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      };

      if (paymentMethod === "cash") {
        // Direct booking for cash payment
        const { data: newBooking, error: bookingError } = await supabase.from("bookings").insert(bookingPayload as any).select().single();

        if (bookingError) throw bookingError;

        // Send notification to saloon owner
        const { data: saloonData } = await supabase.from("saloons").select("owner_id, name").eq("id", saloon!.id).single();
        if (saloonData) {
          await supabase.from("notifications").insert({
            user_id: saloonData.owner_id,
            title: "New Booking!",
            message: `New booking at ${saloonData.name} for ${format(selectedDate!, "PPP")} at ${selectedTimeSlot}`,
            type: "booking",
            data: { booking_id: newBooking.id },
          });

          // Send email notification
          supabase.functions.invoke("send-booking-notification", {
            body: {
              bookingId: newBooking.id,
              saloonId: saloon!.id,
              customerName: user.email?.split("@")[0] || "Customer",
              customerPhone: customerPhone.trim(),
              bookingDate: format(selectedDate!, "PPP"),
              timeSlot: selectedTimeSlot,
              services: selectedServices.map((s) => s.name),
              totalPrice,
              paymentMethod: "cash",
            },
          }).catch((err) => console.error("Email notification error:", err));
        }

        toast({
          title: "Booking confirmed!",
          description: "Pay at the salon. Your appointment is confirmed.",
        });
        navigate("/dashboard");
      } else {
        // Online payment via Razorpay
        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .insert(bookingPayload as any)
          .select()
          .single();

        if (bookingError) throw bookingError;

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: {
            bookingId: booking.id,
            amount: totalPrice,
          },
        });

        if (orderError) throw orderError;

        if (!razorpayLoaded) {
          toast({ title: "Payment gateway loading...", description: "Please wait" });
          setIsBooking(false);
          return;
        }

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: saloon?.name || "Saloon Booking",
          description: `${selectedServices.map((s) => s.name).join(", ")} - ${format(selectedDate!, "PPP")} at ${selectedTimeSlot}`,
          order_id: orderData.orderId,
          handler: async function (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId: booking.id,
              },
            });

            if (verifyError || !verifyData?.success) {
              toast({ title: "Payment verification failed", variant: "destructive" });
            } else {
              toast({
                  title: "Booking confirmed!",
                  description: "Your appointment has been booked and paid",
                });
                
                // Send notification to saloon owner
                const { data: saloonData } = await supabase.from("saloons").select("owner_id, name").eq("id", saloon!.id).single();
                if (saloonData) {
                  await supabase.from("notifications").insert({
                    user_id: saloonData.owner_id,
                    title: "New Paid Booking!",
                    message: `New online booking at ${saloonData.name} for ${format(selectedDate!, "PPP")} at ${selectedTimeSlot}`,
                    type: "booking",
                    data: { booking_id: booking.id },
                  });

                  // Send email notification
                  supabase.functions.invoke("send-booking-notification", {
                    body: {
                      bookingId: booking.id,
                      saloonId: saloon!.id,
                      customerName: user.email?.split("@")[0] || "Customer",
                      customerPhone: customerPhone,
                      bookingDate: format(selectedDate!, "PPP"),
                      timeSlot: selectedTimeSlot,
                      services: selectedServices.map((s) => s.name),
                      totalPrice,
                      paymentMethod: "online",
                    },
                  }).catch((err) => console.error("Email notification error:", err));
                }
                
                navigate("/dashboard");
            }
          },
          prefill: {
            email: user.email,
            contact: customerPhone,
          },
          theme: { color: "#F97316" },
          modal: {
            ondismiss: function() {
              toast({
                title: "Payment cancelled",
                description: "Your booking is saved but not confirmed until payment",
              });
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Booking failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!saloon) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container py-8">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Salon not found</p>
          </Card>
        </div>
      </div>
    );
  }

  const timeSlots = generateTimeSlots();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero Image */}
            <Card className="overflow-hidden shadow-elevated">
              <div className="relative h-96 bg-gradient-to-br from-primary/10 to-secondary/10">
                {saloon.images && saloon.images.length > 0 ? (
                  <img src={saloon.images[0]} alt={saloon.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No Image</div>
                )}
                <Badge className="absolute top-4 right-4 bg-white/90 text-primary hover:bg-white text-lg px-3 py-1">
                  <Star className="w-4 h-4 mr-1 fill-primary" />
                  {saloon.rating.toFixed(1)}
                </Badge>
              </div>
            </Card>

            {/* Salon Info */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-3xl">{saloon.name}</CardTitle>
                <CardDescription className="text-base">{saloon.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-muted-foreground">
                      {saloon.address}, {saloon.city}, {saloon.state} - {saloon.pincode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Timings</p>
                    <p className="text-muted-foreground">{saloon.opening_time} - {saloon.closing_time}</p>
                  </div>
                </div>
                {saloon.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Contact</p>
                      <p className="text-muted-foreground">{saloon.phone}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Map */}
            <SalonMap
              latitude={saloon.latitude ?? null}
              longitude={saloon.longitude ?? null}
              name={saloon.name}
              address={`${saloon.address}, ${saloon.city}`}
            />

            {/* Booking Calendar */}
            <BookingCalendar
              saloonId={saloon!.id}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />

            {/* Reviews Section */}
            <SaloonReviews saloonId={saloon!.id} showUserNames={true} />

            {/* Barbers Section */}
            {barbers.length > 0 && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scissors className="w-5 h-5" />
                    Choose Your Barber (Optional)
                  </CardTitle>
                  <CardDescription>Select a barber or skip to get any available</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all text-center",
                        selectedBarber === null
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setSelectedBarber(null)}
                    >
                      <Avatar className="w-16 h-16 mx-auto mb-2">
                        <AvatarFallback className="bg-muted"><User className="w-8 h-8" /></AvatarFallback>
                      </Avatar>
                      <p className="font-medium">Any Available</p>
                      <p className="text-xs text-muted-foreground">First available barber</p>
                    </div>
                    
                    {barbers.map((barber) => (
                      <div
                        key={barber.id}
                        className={cn(
                          "p-4 rounded-lg border-2 cursor-pointer transition-all text-center",
                          selectedBarber?.id === barber.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                        onClick={() => setSelectedBarber(barber)}
                      >
                        <Avatar className="w-16 h-16 mx-auto mb-2">
                          <AvatarImage src={barber.avatar_url} alt={barber.name} />
                          <AvatarFallback>{barber.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{barber.name}</p>
                        <p className="text-xs text-muted-foreground">{barber.specialization}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Services - Multi-select grouped by category */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Select Services</CardTitle>
                <CardDescription>Choose one or more services (click to select)</CardDescription>
              </CardHeader>
              <CardContent>
                {services.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No services available</p>
                ) : (
                  <div className="space-y-6">
                    {/* Group services by category */}
                    {Object.entries(
                      services.reduce((acc, service) => {
                        const cat = service.category || 'General';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(service);
                        return acc;
                      }, {} as Record<string, Service[]>)
                    ).map(([category, categoryServices]) => (
                      <div key={category}>
                        <h4 className="font-semibold text-lg mb-3 text-primary">{category}</h4>
                        <div className="grid gap-3">
                          {categoryServices.map((service) => {
                            const isSelected = selectedServices.some((s) => s.id === service.id);
                            return (
                              <div
                                key={service.id}
                                className={cn(
                                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                )}
                                onClick={() => toggleService(service)}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      className="mt-1"
                                      onCheckedChange={() => toggleService(service)}
                                    />
                                    <div>
                                      <h4 className="font-semibold">{service.name}</h4>
                                      <p className="text-sm text-muted-foreground">{service.description}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="flex items-center font-bold text-lg">
                                      <IndianRupee className="w-4 h-4" />
                                      {service.price}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="shadow-elevated sticky top-20">
              <CardHeader>
                <CardTitle>Book Appointment</CardTitle>
                <CardDescription>Complete your booking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Time Slots */}
                {selectedDate && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Time Slot</label>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {timeSlots.map((slot) => {
                        const isBooked = bookedSlots.includes(slot);
                        const count = slotCounts[slot] || 0;
                        return (
                          <Button
                            key={slot}
                            variant={selectedTimeSlot === slot ? "default" : "outline"}
                            className={cn(
                              "text-sm relative",
                              selectedTimeSlot === slot && "gradient-saffron",
                              isBooked && "opacity-50 cursor-not-allowed line-through"
                            )}
                            onClick={() => !isBooked && setSelectedTimeSlot(slot)}
                            disabled={isBooked}
                          >
                            {slot}
                            {count > 0 && !isBooked && (
                              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                {count}
                              </span>
                            )}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Customer Details */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Your Details</h4>
                  <div>
                    <Label htmlFor="phone">Mobile Number *</Label>
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address (Optional)</Label>
                    <Textarea
                      id="address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Your address"
                      rows={2}
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="font-medium">Payment Method</h4>
                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "online" | "cash")}>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="online" id="online" />
                      <Label htmlFor="online" className="flex items-center gap-2 cursor-pointer flex-1">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <span>Pay Online (Razorpay)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value="cash" id="cash" />
                      <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Banknote className="w-5 h-5 text-green-600" />
                        <span>Pay at Salon (Cash)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Booking Summary */}
                {selectedServices.length > 0 && (
                  <div className="pt-4 border-t space-y-2">
                    <h4 className="font-medium">Booking Summary</h4>
                    {selectedServices.map((s) => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span>₹{s.price}</span>
                      </div>
                    ))}
                    {selectedBarber && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Barber:</span>
                        <span>{selectedBarber.name}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{totalDuration} min</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total:</span>
                      <span className="flex items-center">
                        <IndianRupee className="w-4 h-4" />
                        {totalPrice}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full gradient-saffron"
                  size="lg"
                  onClick={handleBooking}
                  disabled={selectedServices.length === 0 || !selectedDate || !selectedTimeSlot || isBooking}
                >
                  {isBooking ? "Processing..." : paymentMethod === "cash" ? "Confirm Booking" : "Pay & Book"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  {paymentMethod === "cash" 
                    ? "Pay at the salon on your visit"
                    : "Secure payment powered by Razorpay"
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaloonDetail;
