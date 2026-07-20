import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { ReviewDialog } from "@/components/ReviewDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, IndianRupee, Star, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CancelBookingDialog } from "@/components/CancelBookingDialog";
import { CustomerWallet } from "@/components/CustomerWallet";

interface Booking {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total_price: number;
  saloon_id: string;
  cancellation_reason?: string | null;
  refund_status?: string | null;
  saloons: {
    name: string;
    address: string;
    city: string;
  };
  services: {
    name: string;
  };
  hasReview?: boolean;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(`
          *,
          saloons (name, address, city),
          services (name)
        `)
        .eq("user_id", user?.id)
        .order("booking_date", { ascending: false });

      if (bookingsError) throw bookingsError;

      // Check which bookings have reviews
      const { data: reviews } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("user_id", user?.id);

      const reviewedBookingIds = new Set(reviews?.map(r => r.booking_id) || []);

      const bookingsWithReviewStatus = (bookingsData || []).map(booking => ({
        ...booking,
        hasReview: reviewedBookingIds.has(booking.id),
      }));

      setBookings(bookingsWithReviewStatus);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Error loading bookings",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-secondary text-secondary-foreground";
      case "pending":
        return "bg-accent text-accent-foreground";
      case "completed":
        return "bg-primary text-primary-foreground";
      case "cancelled":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const upcomingBookings = bookings.filter(
    (b) => b.status !== "completed" && b.status !== "cancelled"
  );
  const pastBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled"
  );

  const BookingCard = ({ booking }: { booking: Booking }) => (
    <Card className="shadow-card hover:shadow-elevated transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{booking.saloons.name}</CardTitle>
            <CardDescription>{booking.services.name}</CardDescription>
          </div>
          <Badge className={getStatusColor(booking.status)}>
            {booking.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{format(new Date(booking.booking_date), "PPP")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span>{booking.time_slot}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-primary" />
          <span>
            {booking.saloons.address}, {booking.saloons.city}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold pt-2 border-t">
          <IndianRupee className="w-4 h-4" />
          <span>{booking.total_price}</span>
        </div>

        {(booking.status === "pending" || booking.status === "confirmed") && (
          <CancelBookingDialog
            bookingId={booking.id}
            paymentStatus={booking.payment_status}
            paymentMethod={booking.payment_method}
            totalPrice={booking.total_price}
            onCancelled={fetchBookings}
          />
        )}

        {booking.status === "cancelled" && booking.refund_status && booking.refund_status !== "not_applicable" && (
          <Badge variant="outline" className="w-full justify-center capitalize">
            Refund: {booking.refund_status}
          </Badge>
        )}

        {/* Review button for completed bookings */}
        {booking.status === "completed" && !booking.hasReview && (
          <ReviewDialog
            saloonId={booking.saloon_id}
            saloonName={booking.saloons.name}
            bookingId={booking.id}
            onReviewSubmitted={fetchBookings}
          />
        )}
        {booking.status === "completed" && booking.hasReview && (
          <Badge variant="outline" className="w-full justify-center">
            <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
            Review Submitted
          </Badge>
        )}
      </CardContent>
    </Card>
  );

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            My <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Bookings</span>
          </h1>
          <p className="text-muted-foreground text-lg">Manage your salon appointments</p>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              Past ({pastBookings.length})
            </TabsTrigger>
            <TabsTrigger value="wallet">
              <Wallet className="w-4 h-4 mr-1" /> Wallet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {upcomingBookings.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No upcoming bookings</p>
                <Button asChild className="gradient-saffron">
                  <Link to="/saloons">Browse Salons</Link>
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="mt-6">
            {pastBookings.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No past bookings</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pastBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="wallet" className="mt-6 max-w-2xl">
            <CustomerWallet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
