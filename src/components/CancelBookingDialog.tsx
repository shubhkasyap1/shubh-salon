import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  bookingId: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalPrice: number;
  onCancelled: () => void;
}

export const CancelBookingDialog = ({ bookingId, paymentStatus, paymentMethod, totalPrice, onCancelled }: Props) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundMode, setRefundMode] = useState<"wallet" | "razorpay" | "none">(
    paymentStatus === "completed" ? "wallet" : "none"
  );
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const wasPaidOnline = paymentStatus === "completed" && paymentMethod !== "cash";

  const submit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-booking", {
        body: { bookingId, reason, refundMode: wasPaidOnline ? refundMode : "none" },
      });
      if (error) throw error;
      const msg = data?.refundMessage || "Your booking has been cancelled.";
      toast({ title: "Booking cancelled", description: msg });
      setOpen(false);
      onCancelled();
    } catch (err: any) {
      toast({ title: "Cancellation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full">
          <X className="w-4 h-4 mr-2" /> Cancel Booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. {wasPaidOnline && `You paid ₹${totalPrice} online — choose how to receive your refund.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Change of plan, wrong slot…" />
          </div>
          {wasPaidOnline && (
            <div>
              <Label>Refund to</Label>
              <RadioGroup value={refundMode} onValueChange={(v: any) => setRefundMode(v)} className="mt-2 space-y-2">
                <label className="flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="wallet" id="rw" />
                  <div>
                    <div className="font-medium">Wallet credit (instant)</div>
                    <div className="text-xs text-muted-foreground">₹{totalPrice} added instantly; use for your next booking.</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 border rounded-md p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="razorpay" id="rr" />
                  <div>
                    <div className="font-medium">Refund to original payment (5–7 days)</div>
                    <div className="text-xs text-muted-foreground">Refunded to the card/UPI you used.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Keep booking</Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Confirm cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};