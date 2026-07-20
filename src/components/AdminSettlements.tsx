import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IndianRupee, ChevronDown, ChevronUp, Check, Building2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SaloonWithPendingAmount {
  id: string;
  name: string;
  city: string;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  gst_number: string | null;
  pan_number: string | null;
  pendingAmount: number;
  completedBookings: number;
  lastSettlement: string | null;
}

interface Settlement {
  id: string;
  saloon_id: string;
  amount: number;
  period_start: string;
  period_end: string;
  status: string;
  transaction_reference: string | null;
  notes: string | null;
  settled_at: string | null;
  created_at: string;
  saloon?: { name: string };
}

export const AdminSettlements = () => {
  const { toast } = useToast();
  const [saloonData, setSaloonData] = useState<SaloonWithPendingAmount[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSaloon, setExpandedSaloon] = useState<string | null>(null);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedSaloon, setSelectedSaloon] = useState<SaloonWithPendingAmount | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [settleNotes, setSettleNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchSaloonPendingAmounts(), fetchSettlements()]);
    setIsLoading(false);
  };

  const fetchSaloonPendingAmounts = async () => {
    // Get all saloons with bank details
    const { data: saloons, error: saloonError } = await supabase
      .from("saloons")
      .select("id, name, city, bank_account_name, bank_account_number, bank_ifsc_code, bank_name, gst_number, pan_number");

    if (saloonError || !saloons) return;

    // Get all completed online payments
    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select("saloon_id, total_price, payment_status, payment_method, created_at")
      .eq("payment_status", "completed")
      .eq("payment_method", "online");

    if (bookingError) return;

    // Get all settlements to calculate already settled amounts
    const { data: allSettlements, error: settlementError } = await supabase
      .from("settlements")
      .select("saloon_id, amount, status, settled_at")
      .in("status", ["completed", "pending"]);

    const settledAmounts: Record<string, number> = {};
    const lastSettlementDates: Record<string, string> = {};

    allSettlements?.forEach((s) => {
      if (s.status === "completed") {
        settledAmounts[s.saloon_id] = (settledAmounts[s.saloon_id] || 0) + Number(s.amount);
        if (!lastSettlementDates[s.saloon_id] || s.settled_at > lastSettlementDates[s.saloon_id]) {
          lastSettlementDates[s.saloon_id] = s.settled_at;
        }
      }
    });

    // Calculate pending amounts per saloon
    const saloonAmounts: Record<string, { total: number; count: number }> = {};
    bookings?.forEach((b) => {
      if (!saloonAmounts[b.saloon_id]) {
        saloonAmounts[b.saloon_id] = { total: 0, count: 0 };
      }
      saloonAmounts[b.saloon_id].total += Number(b.total_price);
      saloonAmounts[b.saloon_id].count += 1;
    });

    const result: SaloonWithPendingAmount[] = saloons.map((saloon) => ({
      ...saloon,
      pendingAmount: (saloonAmounts[saloon.id]?.total || 0) - (settledAmounts[saloon.id] || 0),
      completedBookings: saloonAmounts[saloon.id]?.count || 0,
      lastSettlement: lastSettlementDates[saloon.id] || null,
    }));

    // Sort by pending amount descending
    result.sort((a, b) => b.pendingAmount - a.pendingAmount);
    setSaloonData(result);
  };

  const fetchSettlements = async () => {
    const { data, error } = await supabase
      .from("settlements")
      .select("*, saloon:saloons(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      setSettlements(data);
    }
  };

  const handleSettle = async () => {
    if (!selectedSaloon || selectedSaloon.pendingAmount <= 0) return;

    const { error } = await supabase.from("settlements").insert({
      saloon_id: selectedSaloon.id,
      amount: selectedSaloon.pendingAmount,
      period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      period_end: new Date().toISOString().split("T")[0],
      status: "completed",
      transaction_reference: transactionRef || null,
      notes: settleNotes || null,
      settled_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: "Error creating settlement", variant: "destructive" });
    } else {
      toast({ title: "Settlement recorded successfully" });
      setSettleDialogOpen(false);
      setTransactionRef("");
      setSettleNotes("");
      setSelectedSaloon(null);
      fetchData();
    }
  };

  const totalPending = saloonData.reduce((sum, s) => sum + Math.max(0, s.pendingAmount), 0);
  const saloonsWithPending = saloonData.filter((s) => s.pendingAmount > 0).length;

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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                <IndianRupee className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{totalPending.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Pending Payouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{saloonsWithPending}</p>
                <p className="text-sm text-muted-foreground">Saloons with Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{settlements.filter((s) => s.status === "completed").length}</p>
                <p className="text-sm text-muted-foreground">Completed Settlements</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts by Saloon */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Payouts by Saloon</CardTitle>
          <CardDescription>Click to view bank details and settle payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {saloonData.filter((s) => s.pendingAmount > 0).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No pending payouts</p>
            ) : (
              saloonData
                .filter((s) => s.pendingAmount > 0)
                .map((saloon) => (
                  <Collapsible
                    key={saloon.id}
                    open={expandedSaloon === saloon.id}
                    onOpenChange={() => setExpandedSaloon(expandedSaloon === saloon.id ? null : saloon.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{saloon.name}</p>
                            <p className="text-sm text-muted-foreground">{saloon.city} • {saloon.completedBookings} bookings</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold text-lg text-orange-600">₹{saloon.pendingAmount.toLocaleString()}</p>
                            {saloon.lastSettlement && (
                              <p className="text-xs text-muted-foreground">
                                Last: {format(new Date(saloon.lastSettlement), "MMM dd, yyyy")}
                              </p>
                            )}
                          </div>
                          {expandedSaloon === saloon.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="p-4 border border-t-0 rounded-b-lg bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <CreditCard className="h-4 w-4" /> Bank Details
                            </h4>
                            {saloon.bank_account_number ? (
                              <div className="space-y-1 text-sm">
                                <p><span className="text-muted-foreground">Account Name:</span> {saloon.bank_account_name || "N/A"}</p>
                                <p><span className="text-muted-foreground">Account No:</span> {saloon.bank_account_number}</p>
                                <p><span className="text-muted-foreground">IFSC:</span> {saloon.bank_ifsc_code || "N/A"}</p>
                                <p><span className="text-muted-foreground">Bank:</span> {saloon.bank_name || "N/A"}</p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No bank details provided</p>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Tax Details</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">GST:</span> {saloon.gst_number || "N/A"}</p>
                              <p><span className="text-muted-foreground">PAN:</span> {saloon.pan_number || "N/A"}</p>
                            </div>
                          </div>
                        </div>
                        <Dialog open={settleDialogOpen && selectedSaloon?.id === saloon.id} onOpenChange={(open) => {
                          setSettleDialogOpen(open);
                          if (open) setSelectedSaloon(saloon);
                        }}>
                          <DialogTrigger asChild>
                            <Button className="w-full" onClick={() => setSelectedSaloon(saloon)}>
                              <Check className="h-4 w-4 mr-2" />
                              Mark as Settled (₹{saloon.pendingAmount.toLocaleString()})
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirm Settlement</DialogTitle>
                              <DialogDescription>
                                Record settlement of ₹{saloon.pendingAmount.toLocaleString()} to {saloon.name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="transactionRef">Transaction Reference</Label>
                                <Input
                                  id="transactionRef"
                                  placeholder="e.g., UTR number, transaction ID"
                                  value={transactionRef}
                                  onChange={(e) => setTransactionRef(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="notes">Notes (Optional)</Label>
                                <Textarea
                                  id="notes"
                                  placeholder="Any additional notes..."
                                  value={settleNotes}
                                  onChange={(e) => setSettleNotes(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>Cancel</Button>
                              <Button onClick={handleSettle}>Confirm Settlement</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Settlement History */}
      <Card>
        <CardHeader>
          <CardTitle>Settlement History</CardTitle>
          <CardDescription>Recent payment settlements to saloon owners</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Saloon</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Settled At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No settlements recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                settlements.map((settlement) => (
                  <TableRow key={settlement.id}>
                    <TableCell className="font-medium">{settlement.saloon?.name}</TableCell>
                    <TableCell>₹{Number(settlement.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      {format(new Date(settlement.period_start), "MMM dd")} - {format(new Date(settlement.period_end), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>{settlement.transaction_reference || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={settlement.status === "completed" ? "default" : "secondary"}>
                        {settlement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {settlement.settled_at ? format(new Date(settlement.settled_at), "MMM dd, yyyy HH:mm") : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
