import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Printer, IndianRupee, Plus, UserPlus, Scissors } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Booking {
  id: string;
  booking_date: string;
  time_slot: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_price: number;
  razorpay_payment_id: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  created_at: string;
  selected_services: unknown;
  services: { name: string } | null;
  barbers: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string | null;
}

interface Barber {
  id: string;
  name: string;
  is_active: boolean;
}

interface Saloon {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string | null;
  gst_number: string | null;
}

interface SaloonBillingProps {
  saloonId: string;
}

interface OfflineBill {
  id: string;
  customer_name: string;
  customer_phone: string;
  services: { name: string; price: number }[];
  total_price: number;
  payment_method: string;
  created_at: string;
  barber_name?: string;
}

export const SaloonBilling = ({ saloonId }: SaloonBillingProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [saloon, setSaloon] = useState<Saloon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  
  // Offline billing state
  const [offlineBillDialogOpen, setOfflineBillDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [selectedBarber, setSelectedBarber] = useState<string>("");
  const [isCreatingBill, setIsCreatingBill] = useState(false);
  const [offlineBillPreview, setOfflineBillPreview] = useState<OfflineBill | null>(null);
  const [offlineBillPreviewOpen, setOfflineBillPreviewOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [saloonId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [saloonRes, bookingsRes, servicesRes, barbersRes] = await Promise.all([
      supabase.from("saloons").select("id, name, address, city, state, pincode, phone, gst_number").eq("id", saloonId).single(),
      supabase
        .from("bookings")
        .select("*, services(name), barbers(name)")
        .eq("saloon_id", saloonId)
        .eq("payment_status", "completed")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("services")
        .select("id, name, price, category")
        .eq("saloon_id", saloonId)
        .eq("is_active", true)
        .order("price"),
      supabase
        .from("barbers")
        .select("id, name, is_active")
        .eq("saloon_id", saloonId)
        .eq("is_active", true)
        .order("name"),
    ]);

    if (saloonRes.data) setSaloon(saloonRes.data);
    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (barbersRes.data) setBarbers(barbersRes.data);
    
    setIsLoading(false);
  };

  const generateInvoiceNumber = (bookingId: string, date: string) => {
    const dateStr = format(new Date(date), "yyyyMMdd");
    return `INV-${dateStr}-${bookingId.slice(0, 8).toUpperCase()}`;
  };

  const calculateGST = (amount: number) => {
    const gstRate = 0.18; // 18% GST
    const baseAmount = amount / (1 + gstRate);
    const gstAmount = amount - baseAmount;
    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      cgst: Math.round((gstAmount / 2) * 100) / 100,
      sgst: Math.round((gstAmount / 2) * 100) / 100,
    };
  };

  const handlePrint = () => {
    window.print();
  };

  const getSelectedServicesTotal = () => {
    return services
      .filter(s => selectedServices.includes(s.id))
      .reduce((sum, s) => sum + Number(s.price), 0);
  };

  const getSelectedServicesDetails = () => {
    return services
      .filter(s => selectedServices.includes(s.id))
      .map(s => ({ name: s.name, price: Number(s.price) }));
  };

  const handleCreateOfflineBill = async () => {
    if (!customerName.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }
    if (!customerPhone.trim() || !/^\d{10}$/.test(customerPhone)) {
      toast({ title: "Valid 10-digit phone number is required", variant: "destructive" });
      return;
    }
    if (selectedServices.length === 0) {
      toast({ title: "Please select at least one service", variant: "destructive" });
      return;
    }

    setIsCreatingBill(true);
    try {
      const servicesDetails = getSelectedServicesDetails();
      const totalPrice = getSelectedServicesTotal();
      const firstServiceId = selectedServices[0];

      // Create booking record for walk-in customer
      const { data, error } = await supabase.from("bookings").insert({
        user_id: user?.id,
        saloon_id: saloonId,
        service_id: firstServiceId,
        selected_services: servicesDetails,
        booking_date: new Date().toISOString().split("T")[0],
        time_slot: format(new Date(), "HH:mm"),
        total_price: totalPrice,
        payment_method: paymentMethod,
        payment_status: "completed",
        status: "completed",
        customer_phone: customerPhone,
        notes: `Walk-in: ${customerName}`,
        barber_id: selectedBarber || null,
      }).select().single();

      const selectedBarberName = barbers.find(b => b.id === selectedBarber)?.name;

      if (error) throw error;

      // Create offline bill preview for printing
      const offlineBill: OfflineBill = {
        id: data.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        services: servicesDetails,
        total_price: totalPrice,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        barber_name: selectedBarberName,
      };

      setOfflineBillPreview(offlineBill);
      setOfflineBillDialogOpen(false);
      setOfflineBillPreviewOpen(true);
      
      // Reset form
      setCustomerName("");
      setCustomerPhone("");
      setSelectedServices([]);
      setPaymentMethod("cash");
      setSelectedBarber("");
      
      toast({ title: "Bill created successfully!" });
      fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error creating bill", description: message, variant: "destructive" });
    } finally {
      setIsCreatingBill(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const totalRevenue = bookings.reduce((sum, b) => sum + b.total_price, 0);
  const onlineRevenue = bookings.filter(b => b.payment_method === "online").reduce((sum, b) => sum + b.total_price, 0);
  const cashRevenue = bookings.filter(b => b.payment_method === "cash").reduce((sum, b) => sum + b.total_price, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Offline Bill Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg">Walk-in Billing</h3>
              <p className="text-sm text-muted-foreground">Create bills for walk-in customers</p>
            </div>
            <Button onClick={() => setOfflineBillDialogOpen(true)} size="lg">
              <UserPlus className="h-5 w-5 mr-2" />
              Create New Bill
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                <IndianRupee className="h-6 w-6 text-green-600" />
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
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                <IndianRupee className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{onlineRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Online Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-full">
                <IndianRupee className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{cashRevenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Cash Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Completed Bookings / Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Billing History</CardTitle>
          <CardDescription>View and generate invoices for completed bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No completed bookings yet
                  </TableCell>
                </TableRow>
              ) : (
                bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-mono text-sm">
                      {generateInvoiceNumber(booking.id, booking.created_at)}
                    </TableCell>
                    <TableCell>{format(new Date(booking.booking_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{booking.services?.name || "Multiple Services"}</TableCell>
                    <TableCell>{booking.customer_phone || "-"}</TableCell>
                    <TableCell className="font-medium">₹{booking.total_price.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={booking.payment_method === "cash" ? "outline" : "default"}>
                        {booking.payment_method === "cash" ? "Cash" : "Online"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setInvoiceDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Invoice
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Offline Bill Dialog */}
      <Dialog open={offlineBillDialogOpen} onOpenChange={setOfflineBillDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Walk-in Bill</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Customer Details */}
            <div className="space-y-3">
              <h4 className="font-medium">Customer Details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customerName">Name *</Label>
                  <Input
                    id="customerName"
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone *</Label>
                  <Input
                    id="customerPhone"
                    placeholder="10-digit number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Service Selection */}
            <div className="space-y-3">
              <h4 className="font-medium">Select Services *</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3">
                {services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No services available</p>
                ) : (
                  services.map((service) => (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        selectedServices.includes(service.id) 
                          ? "bg-primary/10 border border-primary" 
                          : "hover:bg-muted"
                      }`}
                      onClick={() => toggleService(service.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <div>
                          <p className="font-medium">{service.name}</p>
                          {service.category && (
                            <p className="text-xs text-muted-foreground">{service.category}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold">₹{Number(service.price).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Barber Selection */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                Select Barber (Optional)
              </h4>
              <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select barber who served" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.length === 0 ? (
                    <SelectItem value="none" disabled>No barbers available</SelectItem>
                  ) : (
                    barbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id}>
                        {barber.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Payment Method */}
            <div className="space-y-3">
              <h4 className="font-medium">Payment Method</h4>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "online")}>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash">Cash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="online" id="online" />
                    <Label htmlFor="online">Online / UPI</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Total */}
            <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
              <span className="font-medium">Total Amount</span>
              <span className="text-2xl font-bold">₹{getSelectedServicesTotal().toLocaleString()}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfflineBillDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOfflineBill} disabled={isCreatingBill}>
              {isCreatingBill ? "Creating..." : "Generate Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offline Bill Preview Dialog */}
      <Dialog open={offlineBillPreviewOpen} onOpenChange={setOfflineBillPreviewOpen}>
        <DialogContent className="max-w-2xl print:max-w-none print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Bill Generated</DialogTitle>
          </DialogHeader>
          
          {offlineBillPreview && saloon && (
            <div className="space-y-6 p-4 print:p-0" id="offline-bill-content">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{saloon.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {saloon.address}, {saloon.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {saloon.state} - {saloon.pincode}
                  </p>
                  {saloon.phone && <p className="text-sm text-muted-foreground">Phone: {saloon.phone}</p>}
                  {saloon.gst_number && (
                    <p className="text-sm font-medium mt-1">GSTIN: {saloon.gst_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold">BILL</h3>
                  <p className="text-sm font-mono">
                    {generateInvoiceNumber(offlineBillPreview.id, offlineBillPreview.created_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Date: {format(new Date(offlineBillPreview.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Customer Details */}
              <div>
                <h4 className="font-medium mb-2">Customer:</h4>
                <p className="text-sm">Name: {offlineBillPreview.customer_name}</p>
                <p className="text-sm">Phone: {offlineBillPreview.customer_phone}</p>
                {offlineBillPreview.barber_name && (
                  <p className="text-sm">Served by: {offlineBillPreview.barber_name}</p>
                )}
              </div>

              <Separator />

              {/* Services */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offlineBillPreview.services.map((service, index) => (
                      <TableRow key={index}>
                        <TableCell>{service.name}</TableCell>
                        <TableCell className="text-right">₹{service.price.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Totals with GST */}
              {(() => {
                const gst = calculateGST(offlineBillPreview.total_price);
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal (excl. GST)</span>
                      <span>₹{gst.baseAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CGST (9%)</span>
                      <span>₹{gst.cgst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST (9%)</span>
                      <span>₹{gst.sgst.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>₹{offlineBillPreview.total_price.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Info */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Payment Method:</span>
                  <span className="font-medium">{offlineBillPreview.payment_method === "cash" ? "Cash" : "Online / UPI"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Payment Status:</span>
                  <Badge variant="default">Paid</Badge>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground">Thank you for your visit!</p>

              {/* Actions */}
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button className="flex-1" onClick={() => setOfflineBillPreviewOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog for online bookings */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-2xl print:max-w-none print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Invoice</DialogTitle>
          </DialogHeader>
          
          {selectedBooking && saloon && (
            <div className="space-y-6 p-4 print:p-0" id="invoice-content">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{saloon.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {saloon.address}, {saloon.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {saloon.state} - {saloon.pincode}
                  </p>
                  {saloon.phone && <p className="text-sm text-muted-foreground">Phone: {saloon.phone}</p>}
                  {saloon.gst_number && (
                    <p className="text-sm font-medium mt-1">GSTIN: {saloon.gst_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-xl font-bold">TAX INVOICE</h3>
                  <p className="text-sm font-mono">
                    {generateInvoiceNumber(selectedBooking.id, selectedBooking.created_at)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Date: {format(new Date(selectedBooking.created_at), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Customer Details */}
              <div>
                <h4 className="font-medium mb-2">Bill To:</h4>
                <p className="text-sm">Phone: {selectedBooking.customer_phone || "Walk-in Customer"}</p>
                {selectedBooking.customer_address && (
                  <p className="text-sm">Address: {selectedBooking.customer_address}</p>
                )}
              </div>

              <Separator />

              {/* Services */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(selectedBooking.selected_services) && selectedBooking.selected_services.length > 0 ? (
                      (selectedBooking.selected_services as { name: string; price: number }[]).map((service, index) => (
                        <TableRow key={index}>
                          <TableCell>{service.name}</TableCell>
                          <TableCell className="text-right">₹{Number(service.price).toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell>{selectedBooking.services?.name || "Service"}</TableCell>
                        <TableCell className="text-right">₹{selectedBooking.total_price.toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Totals with GST */}
              {(() => {
                const gst = calculateGST(selectedBooking.total_price);
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal (excl. GST)</span>
                      <span>₹{gst.baseAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CGST (9%)</span>
                      <span>₹{gst.cgst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST (9%)</span>
                      <span>₹{gst.sgst.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>₹{selectedBooking.total_price.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Info */}
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Payment Method:</span>
                  <span className="font-medium">{selectedBooking.payment_method === "cash" ? "Cash" : "Online"}</span>
                </div>
                {selectedBooking.razorpay_payment_id && (
                  <div className="flex justify-between text-sm">
                    <span>Transaction ID:</span>
                    <span className="font-mono">{selectedBooking.razorpay_payment_id}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Payment Status:</span>
                  <Badge variant="default">Paid</Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" className="flex-1" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button className="flex-1" onClick={handlePrint}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
