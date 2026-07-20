import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRazorpay } from "@/hooks/useRazorpay";
import { formatOrderNumber, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/lib/shop";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface CartRow {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    gst_rate: number;
    stock: number;
  };
}

export const CheckoutDialog = ({
  open,
  onOpenChange,
  items,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: CartRow[];
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isLoaded: rzpLoaded } = useRazorpay();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [payMode, setPayMode] = useState<"online" | "cod">("online");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  const subtotal = items.reduce((s, it) => s + it.product.price * it.quantity, 0);
  const gst = items.reduce((s, it) => s + (it.product.price * it.quantity * it.product.gst_rate) / 100, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = Math.round((subtotal + gst + shipping) * 100) / 100;

  const placeOrder = async () => {
    if (!user) return;
    if (!form.name || !form.phone || !form.line1 || !form.city || !form.state || !form.pincode) {
      toast({ title: "Please fill all address fields", variant: "destructive" });
      return;
    }
    setProcessing(true);

    const orderNumber = formatOrderNumber();
    const { data: order, error } = await supabase
      .from("product_orders")
      .insert({
        user_id: user.id,
        order_number: orderNumber,
        subtotal,
        gst_amount: gst,
        shipping_fee: shipping,
        total,
        payment_method: payMode,
        payment_status: payMode === "cod" ? "pending" : "pending",
        status: "pending",
        shipping_address: form,
        customer_phone: form.phone,
      })
      .select()
      .single();

    if (error || !order) {
      setProcessing(false);
      toast({ title: "Could not create order", description: error?.message, variant: "destructive" });
      return;
    }

    const orderItems = items.map((it) => ({
      order_id: order.id,
      product_id: it.product.id,
      product_name: it.product.name,
      price: it.product.price,
      quantity: it.quantity,
      subtotal: it.product.price * it.quantity,
    }));
    await supabase.from("product_order_items").insert(orderItems);

    if (payMode === "cod") {
      await supabase.from("cart_items").delete().eq("user_id", user.id);
      toast({ title: "Order placed!", description: `Order #${orderNumber}` });
      onOpenChange(false);
      onDone();
      navigate("/my-orders");
      setProcessing(false);
      return;
    }

    // Online payment
    if (!rzpLoaded) {
      toast({ title: "Payment gateway loading, try again", variant: "destructive" });
      setProcessing(false);
      return;
    }

    const { data: rzpData, error: rzpErr } = await supabase.functions.invoke("create-razorpay-order", {
      body: { productOrderId: order.id, orderType: "product_order", amount: total },
    });
    if (rzpErr || !rzpData) {
      toast({ title: "Payment init failed", variant: "destructive" });
      setProcessing(false);
      return;
    }

    const rzp = new (window as any).Razorpay({
      key: rzpData.keyId,
      amount: rzpData.amount,
      currency: rzpData.currency,
      order_id: rzpData.orderId,
      name: "SaloonBook Shop",
      description: `Order ${orderNumber}`,
      prefill: { name: form.name, contact: form.phone, email: user.email },
      handler: async (resp: any) => {
        const { data: verify } = await supabase.functions.invoke("verify-razorpay-payment", {
          body: {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
            productOrderId: order.id,
            orderType: "product_order",
          },
        });
        if (verify?.success) {
          await supabase.from("cart_items").delete().eq("user_id", user!.id);
          toast({ title: "Payment successful!", description: `Order #${orderNumber}` });
          onOpenChange(false);
          onDone();
          navigate("/my-orders");
        } else {
          toast({ title: "Payment verification failed", variant: "destructive" });
        }
        setProcessing(false);
      },
      modal: { ondismiss: () => setProcessing(false) },
      theme: { color: "#FF6B35" },
    });
    rzp.open();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
          </div>
          <div>
            <Label>Address Line 2 (optional)</Label>
            <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <Label>PIN</Label>
              <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Payment Method</Label>
            <RadioGroup value={payMode} onValueChange={(v: "online" | "cod") => setPayMode(v)}>
              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="online" id="pm-online" />
                <Label htmlFor="pm-online" className="flex-1 cursor-pointer">Pay Online (Razorpay)</Label>
              </div>
              <div className="flex items-center space-x-2 border rounded p-3">
                <RadioGroupItem value="cod" id="pm-cod" />
                <Label htmlFor="pm-cod" className="flex-1 cursor-pointer">Cash on Delivery</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>GST</span><span>₹{gst.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "FREE" : `₹${shipping}`}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>Cancel</Button>
          <Button onClick={placeOrder} disabled={processing} className="gradient-saffron">
            {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Place Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};