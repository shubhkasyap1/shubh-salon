import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import { CheckoutDialog } from "@/components/shop/CheckoutDialog";
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from "@/lib/shop";
import { useToast } from "@/hooks/use-toast";

const Cart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(id, name, price, gst_rate, stock, images, slug)")
      .eq("user_id", user.id);
    setItems(data || []);
    setLoading(false);
  };

  const updateQty = async (id: string, qty: number, max: number) => {
    if (qty < 1) return;
    if (qty > max) {
      toast({ title: `Only ${max} in stock`, variant: "destructive" });
      return;
    }
    await supabase.from("cart_items").update({ quantity: qty }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("cart_items").delete().eq("id", id);
    load();
  };

  const subtotal = items.reduce((s, it) => s + (it.product?.price || 0) * it.quantity, 0);
  const gst = items.reduce((s, it) => s + ((it.product?.price || 0) * it.quantity * (it.product?.gst_rate || 0)) / 100, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + gst + shipping;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <ShoppingBag className="w-7 h-7" /> Your Cart
        </h1>
        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-muted-foreground">Your cart is empty</p>
              <Button asChild><Link to="/shop">Continue Shopping</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              {items.map((it) => (
                <Card key={it.id}>
                  <CardContent className="p-4 flex gap-4 items-center">
                    <Link to={`/shop/${it.product.slug}`}>
                      <div className="w-20 h-20 bg-muted rounded overflow-hidden">
                        {it.product?.images?.[0] && <img src={it.product.images[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                    </Link>
                    <div className="flex-1">
                      <Link to={`/shop/${it.product.slug}`} className="font-medium hover:text-primary">{it.product.name}</Link>
                      <p className="text-sm text-muted-foreground">₹{it.product.price} × {it.quantity}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(it.id, it.quantity - 1, it.product.stock)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">{it.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(it.id, it.quantity + 1, it.product.stock)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="font-bold">₹{(it.product.price * it.quantity).toFixed(2)}</p>
                      <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-semibold mb-3">Order Summary</h3>
                  <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span>GST</span><span>₹{gst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span>Shipping</span><span>{shipping === 0 ? "FREE" : `₹${shipping}`}</span></div>
                  {shipping > 0 && (
                    <p className="text-xs text-muted-foreground">Add ₹{(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(0)} more for free shipping</p>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
                  <Button className="w-full gradient-saffron mt-4" onClick={() => setCheckoutOpen(true)}>Checkout</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <CheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} items={items} onDone={load} />
      </div>
    </div>
  );
};

export default Cart;