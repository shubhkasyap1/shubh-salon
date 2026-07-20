import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { IndianRupee, TrendingUp, Calendar, CreditCard, Banknote } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";

interface RevenueAnalyticsProps {
  saloonId?: string; // Optional - if not provided, shows all saloons (for admin)
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#8884d8", "#82ca9d", "#ffc658"];

export const RevenueAnalytics = ({ saloonId }: RevenueAnalyticsProps) => {
  const [period, setPeriod] = useState("30");
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; bookings: number }[]>([]);
  const [serviceData, setServiceData] = useState<{ name: string; revenue: number }[]>([]);
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [avgBookingValue, setAvgBookingValue] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, [saloonId, period]);

  const fetchAnalytics = async () => {
    const days = parseInt(period);
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    let query = supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        total_price,
        payment_status,
        payment_method,
        service:services(name)
      `)
      .gte("booking_date", startDate)
      .eq("payment_status", "completed");

    if (saloonId) {
      query = query.eq("saloon_id", saloonId);
    }

    const { data, error } = await query;

    if (error || !data) return;

    // Calculate totals
    const total = data.reduce((sum, b) => sum + (b.total_price || 0), 0);
    setTotalRevenue(total);
    setTotalBookings(data.length);
    setAvgBookingValue(data.length > 0 ? total / data.length : 0);

    // Daily revenue
    const dailyRevenue: Record<string, { revenue: number; bookings: number }> = {};
    data.forEach((b) => {
      if (!dailyRevenue[b.booking_date]) {
        dailyRevenue[b.booking_date] = { revenue: 0, bookings: 0 };
      }
      dailyRevenue[b.booking_date].revenue += b.total_price || 0;
      dailyRevenue[b.booking_date].bookings += 1;
    });

    setRevenueData(
      Object.entries(dailyRevenue)
        .map(([date, data]) => ({
          date: format(new Date(date), "MMM dd"),
          revenue: data.revenue,
          bookings: data.bookings,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );

    // Service breakdown
    const serviceRevenue: Record<string, number> = {};
    data.forEach((b) => {
      const serviceName = b.service?.name || "Unknown";
      serviceRevenue[serviceName] = (serviceRevenue[serviceName] || 0) + (b.total_price || 0);
    });

    setServiceData(
      Object.entries(serviceRevenue)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6)
    );

    // Payment method breakdown
    const paymentMethods: Record<string, number> = { online: 0, cash: 0 };
    data.forEach((b) => {
      const method = b.payment_method || "online";
      paymentMethods[method] = (paymentMethods[method] || 0) + (b.total_price || 0);
    });

    setPaymentData([
      { name: "Online", value: paymentMethods.online },
      { name: "Cash", value: paymentMethods.cash },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Revenue Analytics
        </h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <IndianRupee className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBookings}</p>
                <p className="text-sm text-muted-foreground">Completed Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{Math.round(avgBookingValue).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Avg. Booking Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Daily revenue over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === "revenue" ? `₹${value.toLocaleString()}` : value,
                    name === "revenue" ? "Revenue" : "Bookings",
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="bookings" stroke="hsl(var(--secondary))" strokeWidth={2} name="Bookings" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No data available for this period
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Service Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Service</CardTitle>
            <CardDescription>Top performing services</CardDescription>
          </CardHeader>
          <CardContent>
            {serviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No service data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>Cash vs Online payments</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentData.some((p) => p.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ₹${value.toLocaleString()}`}
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No payment data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
