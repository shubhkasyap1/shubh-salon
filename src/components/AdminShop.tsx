import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@/lib/shop";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";

interface Category { id: string; name: string; slug: string; image_url: string | null; is_active: boolean; sort_order: number; }
interface Product {
  id: string; name: string; slug: string; description: string | null; category_id: string | null;
  price: number; mrp: number | null; stock: number; sku: string | null; images: string[];
  brand: string | null; is_active: boolean; is_featured: boolean; gst_rate: number;
}

const emptyProduct: Partial<Product> = {
  name: "", description: "", price: 0, mrp: 0, stock: 0, sku: "", brand: "",
  images: [], is_active: true, is_featured: false, gst_rate: 18, category_id: null,
};

export const AdminShop = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  const [prodDialog, setProdDialog] = useState(false);
  const [prodForm, setProdForm] = useState<any>(emptyProduct);

  const [catDialog, setCatDialog] = useState(false);
  const [catForm, setCatForm] = useState<any>({ name: "", image_url: "", is_active: true, sort_order: 0 });

  const [orderDetail, setOrderDetail] = useState<any>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [p, c, o] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*").order("sort_order"),
      supabase.from("product_orders").select("*, items:product_order_items(*)").order("created_at", { ascending: false }),
    ]);
    if (p.data) setProducts(p.data as any);
    if (c.data) setCategories(c.data as any);
    if (o.data) setOrders(o.data as any);
  };

  // ---- Products ----
  const saveProduct = async () => {
    if (!prodForm.name || !prodForm.price) {
      toast({ title: "Name and price required", variant: "destructive" });
      return;
    }
    const payload = {
      name: prodForm.name,
      slug: prodForm.slug || slugify(prodForm.name),
      description: prodForm.description,
      category_id: prodForm.category_id || null,
      price: Number(prodForm.price),
      mrp: prodForm.mrp ? Number(prodForm.mrp) : null,
      stock: Number(prodForm.stock || 0),
      sku: prodForm.sku,
      images: prodForm.images || [],
      brand: prodForm.brand,
      is_active: prodForm.is_active,
      is_featured: prodForm.is_featured,
      gst_rate: Number(prodForm.gst_rate || 18),
    };
    const { error } = prodForm.id
      ? await supabase.from("products").update(payload).eq("id", prodForm.id)
      : await supabase.from("products").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: prodForm.id ? "Product updated" : "Product created" });
    setProdDialog(false);
    setProdForm(emptyProduct);
    loadAll();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    loadAll();
  };

  // ---- Categories ----
  const saveCategory = async () => {
    if (!catForm.name) return;
    const payload = {
      name: catForm.name,
      slug: catForm.slug || slugify(catForm.name),
      image_url: catForm.image_url || null,
      is_active: catForm.is_active,
      sort_order: Number(catForm.sort_order || 0),
    };
    const { error } = catForm.id
      ? await supabase.from("product_categories").update(payload).eq("id", catForm.id)
      : await supabase.from("product_categories").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: catForm.id ? "Category updated" : "Category created" });
    setCatDialog(false);
    setCatForm({ name: "", image_url: "", is_active: true, sort_order: 0 });
    loadAll();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("product_categories").delete().eq("id", id);
    loadAll();
  };

  // ---- Orders ----
  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from("product_orders").update({ status }).eq("id", orderId);
    toast({ title: "Order status updated" });
    loadAll();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>E-Commerce Management</CardTitle>
        <CardDescription>Manage products, categories and customer orders</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            <TabsTrigger value="categories">Categories ({categories.length})</TabsTrigger>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
          </TabsList>

          {/* Products */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setProdForm(emptyProduct); setProdDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Product
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="flex items-center gap-2">
                      {p.images?.[0] && <img src={p.images[0]} className="w-10 h-10 object-cover rounded" alt="" />}
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{categories.find(c => c.id === p.category_id)?.name || "-"}</TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                        {p.is_featured && <Badge className="gradient-saffron">Featured</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setProdForm(p); setProdDialog(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct(p.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {products.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No products yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setCatForm({ name: "", image_url: "", is_active: true, sort_order: 0 }); setCatDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      {c.image_url && <img src={c.image_url} className="w-8 h-8 object-cover rounded" alt="" />}
                      {c.name}
                    </TableCell>
                    <TableCell>{c.slug}</TableCell>
                    <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setCatForm(c); setCatDialog(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCategory(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>{format(new Date(o.created_at), "MMM dd, HH:mm")}</TableCell>
                    <TableCell>{o.customer_phone}</TableCell>
                    <TableCell>₹{o.total}</TableCell>
                    <TableCell>
                      <Badge variant={o.payment_method === "cod" ? "outline" : "default"}>
                        {o.payment_method === "cod" ? "COD" : o.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                        <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="shipped">Shipped</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setOrderDetail(o)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No orders yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>

        {/* Product Dialog */}
        <Dialog open={prodDialog} onOpenChange={setProdDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{prodForm.id ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={prodForm.name || ""} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={3} value={prodForm.description || ""} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={prodForm.category_id || "none"} onValueChange={(v) => setProdForm({ ...prodForm, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Brand</Label><Input value={prodForm.brand || ""} onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Price ₹ *</Label><Input type="number" value={prodForm.price || 0} onChange={(e) => setProdForm({ ...prodForm, price: e.target.value })} /></div>
                <div><Label>MRP ₹</Label><Input type="number" value={prodForm.mrp || 0} onChange={(e) => setProdForm({ ...prodForm, mrp: e.target.value })} /></div>
                <div><Label>Stock</Label><Input type="number" value={prodForm.stock || 0} onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value })} /></div>
                <div><Label>GST %</Label><Input type="number" value={prodForm.gst_rate || 18} onChange={(e) => setProdForm({ ...prodForm, gst_rate: e.target.value })} /></div>
              </div>
              <div><Label>SKU</Label><Input value={prodForm.sku || ""} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} /></div>
              <div>
                <Label>Images</Label>
                <ImageUpload bucket="saloon-images" images={prodForm.images || []} onImagesChange={(imgs) => setProdForm({ ...prodForm, images: imgs })} maxImages={5} />
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={prodForm.is_active} onCheckedChange={(v) => setProdForm({ ...prodForm, is_active: v })} />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={prodForm.is_featured} onCheckedChange={(v) => setProdForm({ ...prodForm, is_featured: v })} />
                  <Label>Featured</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProdDialog(false)}>Cancel</Button>
              <Button onClick={saveProduct}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={catDialog} onOpenChange={setCatDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>{catForm.id ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={catForm.name || ""} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={catForm.sort_order || 0} onChange={(e) => setCatForm({ ...catForm, sort_order: e.target.value })} /></div>
              <div>
                <Label>Image</Label>
                <ImageUpload bucket="saloon-images" images={catForm.image_url ? [catForm.image_url] : []} onImagesChange={(imgs) => setCatForm({ ...catForm, image_url: imgs[0] || "" })} singleMode />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm({ ...catForm, is_active: v })} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatDialog(false)}>Cancel</Button>
              <Button onClick={saveCategory}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Order Detail Dialog */}
        <Dialog open={!!orderDetail} onOpenChange={(v) => !v && setOrderDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Order {orderDetail?.order_number}</DialogTitle></DialogHeader>
            {orderDetail && (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">Shipping Address</p>
                  <p className="text-muted-foreground">
                    {orderDetail.shipping_address?.name}<br />
                    {orderDetail.shipping_address?.line1}{orderDetail.shipping_address?.line2 ? `, ${orderDetail.shipping_address.line2}` : ""}<br />
                    {orderDetail.shipping_address?.city}, {orderDetail.shipping_address?.state} - {orderDetail.shipping_address?.pincode}<br />
                    Phone: {orderDetail.customer_phone}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Items</p>
                  {orderDetail.items?.map((it: any) => (
                    <div key={it.id} className="flex justify-between border-b py-1">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span>₹{it.subtotal}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{orderDetail.subtotal}</span></div>
                  <div className="flex justify-between"><span>GST</span><span>₹{orderDetail.gst_amount}</span></div>
                  <div className="flex justify-between"><span>Shipping</span><span>₹{orderDetail.shipping_fee}</span></div>
                  <div className="flex justify-between font-bold pt-1 border-t"><span>Total</span><span>₹{orderDetail.total}</span></div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};