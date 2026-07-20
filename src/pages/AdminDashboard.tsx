import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { RevenueAnalytics } from "@/components/RevenueAnalytics";
import { AdminSettlements } from "@/components/AdminSettlements";
import { AdminKycReview } from "@/components/AdminKycReview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Users, Calendar, IndianRupee, TrendingUp, UserCheck, Ban, CheckCircle, XCircle, BarChart3, Wallet, ShoppingBag } from "lucide-react";
import { AdminShop } from "@/components/AdminShop";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Saloon {
  id: string;
  name: string;
  city: string;
  is_active: boolean;
  rating: number;
  created_at: string;
  owner_id: string;
}

interface Booking {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_price: number;
  created_at: string;
  customer_phone: string;
  saloon: { name: string };
  service: { name: string };
}

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

interface UserWithRole {
  profile: UserProfile;
  role: string;
}

interface Stats {
  totalSaloons: number;
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  activeSaloons: number;
  pendingBookings: number;
  cashRevenue: number;
  onlineRevenue: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, userRole, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [saloons, setSaloons] = useState<Saloon[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSaloons: 0,
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    activeSaloons: 0,
    pendingBookings: 0,
    cashRevenue: 0,
    onlineRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "admin")) {
      toast({
        title: "Access Denied",
        description: "You need admin privileges to access this page",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "admin") {
      fetchAllData();
    }
  }, [user, userRole]);

  const fetchAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchSaloons(),
      fetchBookings(),
      fetchUsers(),
      fetchStats(),
    ]);
    setIsLoading(false);
  };

  const fetchSaloons = async () => {
    const { data, error } = await supabase
      .from("saloons")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setSaloons(data);
  };

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        saloon:saloons(name),
        service:services(name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) setBookings(data);
  };

  const fetchUsers = async () => {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("*");

    if (!profileError && !roleError && profiles && roles) {
      const usersWithRoles = profiles.map(profile => ({
        profile,
        role: roles.find(r => r.user_id === profile.id)?.role || "user",
      }));
      setUsers(usersWithRoles);
    }
  };

  const fetchStats = async () => {
    const [saloonsRes, bookingsRes, profilesRes] = await Promise.all([
      supabase.from("saloons").select("id, is_active"),
      supabase.from("bookings").select("id, status, total_price, payment_status, payment_method"),
      supabase.from("profiles").select("id"),
    ]);

    const saloonData = saloonsRes.data || [];
    const bookingData = bookingsRes.data || [];
    const profileData = profilesRes.data || [];

    const completedBookings = bookingData.filter(b => b.payment_status === "completed");

    setStats({
      totalSaloons: saloonData.length,
      activeSaloons: saloonData.filter(s => s.is_active).length,
      totalBookings: bookingData.length,
      pendingBookings: bookingData.filter(b => b.status === "pending").length,
      totalRevenue: completedBookings.reduce((sum, b) => sum + (b.total_price || 0), 0),
      cashRevenue: completedBookings.filter(b => b.payment_method === "cash").reduce((sum, b) => sum + (b.total_price || 0), 0),
      onlineRevenue: completedBookings.filter(b => b.payment_method !== "cash").reduce((sum, b) => sum + (b.total_price || 0), 0),
      totalUsers: profileData.length,
    });
  };

  const toggleSaloonStatus = async (saloonId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("saloons")
      .update({ is_active: !currentStatus })
      .eq("id", saloonId);

    if (error) {
      toast({ title: "Error updating saloon", variant: "destructive" });
    } else {
      toast({ title: `Saloon ${!currentStatus ? "activated" : "deactivated"}` });
      fetchSaloons();
      fetchStats();
    }
  };

  const updateUserRole = async (userId: string, newRole: "user" | "owner" | "admin") => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Error updating user role", variant: "destructive" });
    } else {
      toast({ title: "User role updated" });
      fetchUsers();
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded" />
              ))}
            </div>
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
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage all saloons, users, and bookings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalSaloons}</p>
                  <p className="text-xs text-muted-foreground">Total Saloons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeSaloons}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalBookings}</p>
                  <p className="text-xs text-muted-foreground">Bookings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pendingBookings}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">₹{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">₹{stats.onlineRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">₹{stats.cashRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Cash</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="saloons" className="space-y-4">
          <TabsList>
            <TabsTrigger value="saloons">Saloons</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settlements">
              <Wallet className="w-4 h-4 mr-2" />
              Settlements
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="kyc">
              <UserCheck className="w-4 h-4 mr-2" />
              KYC
            </TabsTrigger>
            <TabsTrigger value="shop">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Shop
            </TabsTrigger>
          </TabsList>

          {/* Saloons Tab */}
          <TabsContent value="saloons">
            <Card>
              <CardHeader>
                <CardTitle>All Saloons</CardTitle>
                <CardDescription>Manage listed saloons</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saloons.map((saloon) => (
                      <TableRow key={saloon.id}>
                        <TableCell className="font-medium">{saloon.name}</TableCell>
                        <TableCell>{saloon.city}</TableCell>
                        <TableCell>{saloon.rating?.toFixed(1) || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={saloon.is_active ? "default" : "secondary"}>
                            {saloon.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(saloon.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <Button
                            variant={saloon.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleSaloonStatus(saloon.id, saloon.is_active)}
                          >
                            {saloon.is_active ? <Ban className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                            {saloon.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>All Bookings</CardTitle>
                <CardDescription>View and manage bookings across all saloons</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Saloon</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.saloon?.name}</TableCell>
                        <TableCell>{booking.service?.name}</TableCell>
                        <TableCell>{format(new Date(booking.booking_date), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{booking.time_slot}</TableCell>
                        <TableCell>{booking.customer_phone || "-"}</TableCell>
                        <TableCell>₹{booking.total_price}</TableCell>
                        <TableCell>
                          <Badge variant={booking.payment_method === "cash" ? "outline" : "default"}>
                            {booking.payment_method === "cash" ? "Cash" : "Online"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            booking.status === "confirmed" ? "default" :
                            booking.status === "completed" ? "secondary" :
                            booking.status === "cancelled" ? "destructive" : "outline"
                          }>
                            {booking.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.profile.id}>
                        <TableCell className="font-medium">{userData.profile.name}</TableCell>
                        <TableCell>{userData.profile.phone || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={
                            userData.role === "admin" ? "destructive" :
                            userData.role === "owner" ? "default" : "secondary"
                          }>
                            {userData.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(userData.profile.created_at), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <Select
                            value={userData.role}
                            onValueChange={(value) => updateUserRole(userData.profile.id, value as "user" | "owner" | "admin")}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settlements Tab */}
          <TabsContent value="settlements">
            <AdminSettlements />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <RevenueAnalytics />
          </TabsContent>

          <TabsContent value="kyc">
            <AdminKycReview />
          </TabsContent>

          <TabsContent value="shop">
            <AdminShop />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
