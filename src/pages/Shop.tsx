import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProductCard, ShopProduct } from "@/components/shop/ProductCard";
import { useToast } from "@/hooks/use-toast";
import { Search, ShoppingBag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

const Shop = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*").eq("is_active", true).order("sort_order"),
    ]);
    if (prodRes.data) setProducts(prodRes.data as any);
    if (catRes.data) setCategories(catRes.data as any);
    setLoading(false);
  };

  const addToCart = async (product: ShopProduct) => {
    if (!user) {
      toast({ title: "Please sign in to add to cart" });
      navigate("/auth");
      return;
    }
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", product.id)
      .maybeSingle();
    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + 1 }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ user_id: user.id, product_id: product.id, quantity: 1 });
    }
    toast({ title: "Added to cart", description: product.name });
  };

  const filtered = products.filter((p) => {
    const matchesCat = !selectedCategory || (p as any).category_id === selectedCategory;
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || "").toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const featured = filtered.filter((p) => p.is_featured);
  const rest = filtered.filter((p) => !p.is_featured);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-7 h-7 text-primary" />
              Saloon Shop
            </h1>
            <p className="text-muted-foreground">Professional products for your grooming needs</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={!selectedCategory ? "default" : "outline"}
            className="cursor-pointer px-3 py-1"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {categories.map((c) => (
            <Badge
              key={c.id}
              variant={selectedCategory === c.id ? "default" : "outline"}
              className="cursor-pointer px-3 py-1"
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.name}
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No products found.
          </div>
        ) : (
          <>
            {featured.length > 0 && !selectedCategory && !search && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold">Featured</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {featured.map((p) => (
                    <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">
                {selectedCategory || search ? "Results" : "All Products"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(featured.length > 0 && !selectedCategory && !search ? rest : filtered).map((p) => (
                  <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Shop;