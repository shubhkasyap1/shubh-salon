import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Package } from "lucide-react";

const statusColor: Record<string, any> = {
  pending: "outline",
  confirmed: "default",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
};

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("product_orders")
      .select("*, items:product_order_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
          <Package className="w-7 h-7" /> My Orders
        </h1>
        {loading ? <p>Loading...</p> : orders.length === 0 ? (
          <Card><CardContent className="py-16 text-center space-y-4">
            <p className="text-muted-foreground">No orders yet</p>
            <Button asChild><Link to="/shop">Start Shopping</Link></Button>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base">Order #{o.order_number}</CardTitle>
                      <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "MMM dd, yyyy • hh:mm a")}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge variant={statusColor[o.status] || "outline"}>{o.status}</Badge>
                      <Badge variant={o.payment_status === "completed" ? "default" : "outline"}>
                        {o.payment_method === "cod" ? "COD" : o.payment_status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    {o.items?.map((it: any) => (
                      <div key={it.id} className="flex justify-between">
                        <span>{it.product_name} × {it.quantity}</span>
                        <span>₹{it.subtotal}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2 border-t mt-2">
                      <span>Total</span><span>₹{o.total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;