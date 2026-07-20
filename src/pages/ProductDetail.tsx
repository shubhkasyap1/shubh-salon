import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IndianRupee, Minus, Plus, ShoppingCart, Zap, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ProductDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (slug) load();
  }, [slug]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").eq("slug", slug).eq("is_active", true).maybeSingle();
    setProduct(data);
    setLoading(false);
  };

  const addToCart = async (goToCart = false) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!product) return;
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ user_id: user.id, product_id: product.id, quantity: qty });
    }
    toast({ title: "Added to cart" });
    if (goToCart) navigate("/cart");
  };

  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="container py-8">Loading...</div></div>;
  if (!product) return <div className="min-h-screen bg-background"><Header /><div className="container py-8">Product not found. <Link to="/shop" className="text-primary underline">Back to shop</Link></div></div>;

  const discount = product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate("/shop")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Shop
        </Button>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Card className="aspect-square overflow-hidden bg-muted">
              {product.images?.[activeImg] ? (
                <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
              )}
            </Card>
            {product.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-2">
                {product.images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`aspect-square rounded border overflow-hidden ${activeImg === i ? "ring-2 ring-primary" : ""}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {product.brand && <p className="text-sm uppercase text-muted-foreground">{product.brand}</p>}
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold flex items-center">
                <IndianRupee className="w-6 h-6" />{product.price}
              </span>
              {product.mrp && product.mrp > product.price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">₹{product.mrp}</span>
                  <Badge variant="destructive">{discount}% OFF</Badge>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Incl. {product.gst_rate}% GST</p>

            {product.stock > 0 ? (
              <Badge variant="outline" className="text-green-600 border-green-600">In Stock</Badge>
            ) : (
              <Badge variant="secondary">Out of Stock</Badge>
            )}

            {product.description && (
              <div className="prose prose-sm max-w-none">
                <h3 className="font-semibold">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            {product.stock > 0 && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm">Quantity:</span>
                  <div className="flex items-center border rounded">
                    <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="w-4 h-4" /></Button>
                    <span className="w-10 text-center">{qty}</span>
                    <Button variant="ghost" size="icon" onClick={() => setQty(Math.min(product.stock, qty + 1))}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => addToCart(false)}>
                    <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                  </Button>
                  <Button className="flex-1 gradient-saffron" onClick={() => addToCart(true)}>
                    <Zap className="w-4 h-4 mr-2" /> Buy Now
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;