import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  mrp: number | null;
  stock: number;
  images: string[];
  brand: string | null;
  is_featured: boolean;
}

export const ProductCard = ({
  product,
  onAddToCart,
}: {
  product: ShopProduct;
  onAddToCart?: (p: ShopProduct) => void;
}) => {
  const discount =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-shadow">
      <Link to={`/shop/${product.slug}`}>
        <div className="aspect-square bg-muted overflow-hidden relative">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
          {product.is_featured && (
            <Badge className="absolute top-2 left-2 gradient-saffron">Featured</Badge>
          )}
          {discount > 0 && (
            <Badge variant="destructive" className="absolute top-2 right-2">
              {discount}% OFF
            </Badge>
          )}
        </div>
      </Link>
      <CardContent className="p-3 space-y-2">
        {product.brand && (
          <p className="text-xs text-muted-foreground uppercase">{product.brand}</p>
        )}
        <Link to={`/shop/${product.slug}`}>
          <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="font-bold flex items-center">
            <IndianRupee className="w-3 h-3" />
            {product.price}
          </span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              ₹{product.mrp}
            </span>
          )}
        </div>
        {product.stock <= 0 ? (
          <Badge variant="secondary" className="w-full justify-center">Out of stock</Badge>
        ) : onAddToCart ? (
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              onAddToCart(product);
            }}
          >
            <ShoppingCart className="w-3 h-3 mr-1" /> Add to Cart
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
};