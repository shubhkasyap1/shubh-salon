import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ImageUpload } from "@/components/ImageUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Scissors, Plus, Pencil, Trash2, User } from "lucide-react";

interface Barber {
  id: string;
  name: string;
  phone: string;
  avatar_url: string;
  specialization: string;
  is_active: boolean;
}

interface BarberManagementProps {
  saloonId: string;
}

export const BarberManagement = ({ saloonId }: BarberManagementProps) => {
  const { toast } = useToast();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [avatarImages, setAvatarImages] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    specialization: "",
  });

  useEffect(() => {
    fetchBarbers();
  }, [saloonId]);

  const fetchBarbers = async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("saloon_id", saloonId)
      .order("name");

    if (!error && data) setBarbers(data);
  };

  const resetForm = () => {
    setForm({ name: "", phone: "", specialization: "" });
    setAvatarImages([]);
    setEditingBarber(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Barber name is required", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      if (editingBarber) {
        const { error } = await supabase
          .from("barbers")
          .update({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            avatar_url: avatarImages[0] || null,
            specialization: form.specialization.trim() || null,
          })
          .eq("id", editingBarber.id);

        if (error) throw error;
        toast({ title: "Barber updated successfully" });
      } else {
        const { error } = await supabase.from("barbers").insert({
          saloon_id: saloonId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          avatar_url: avatarImages[0] || null,
          specialization: form.specialization.trim() || null,
        });

        if (error) throw error;
        toast({ title: "Barber added successfully" });
      }

      resetForm();
      setDialogOpen(false);
      fetchBarbers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Error saving barber", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (barber: Barber) => {
    setEditingBarber(barber);
    setForm({
      name: barber.name,
      phone: barber.phone || "",
      specialization: barber.specialization || "",
    });
    setAvatarImages(barber.avatar_url ? [barber.avatar_url] : []);
    setDialogOpen(true);
  };

  const handleDelete = async (barberId: string) => {
    const { error } = await supabase.from("barbers").delete().eq("id", barberId);

    if (error) {
      toast({ title: "Error deleting barber", variant: "destructive" });
    } else {
      toast({ title: "Barber deleted" });
      fetchBarbers();
    }
  };

  const toggleStatus = async (barber: Barber) => {
    const { error } = await supabase
      .from("barbers")
      .update({ is_active: !barber.is_active })
      .eq("id", barber.id);

    if (error) {
      toast({ title: "Error updating status", variant: "destructive" });
    } else {
      fetchBarbers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Scissors className="w-5 h-5" />
          Barber Management
        </h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gradient-saffron">
              <Plus className="w-4 h-4 mr-2" />
              Add Barber
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingBarber ? "Edit Barber" : "Add New Barber"}</DialogTitle>
              <DialogDescription>
                {editingBarber ? "Update barber information" : "Add a new barber to your salon"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter barber name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  placeholder="e.g., Hair Styling, Beard Trim"
                />
              </div>
              <div>
                <Label>Profile Photo</Label>
                <ImageUpload
                  bucket="barber-avatars"
                  images={avatarImages}
                  onImagesChange={setAvatarImages}
                  singleMode
                />
              </div>
              <Button type="submit" className="w-full gradient-saffron" disabled={isLoading}>
                {isLoading ? "Saving..." : editingBarber ? "Update Barber" : "Add Barber"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {barbers.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No barbers added yet</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {barbers.map((barber) => (
            <Card key={barber.id} className={`shadow-card ${!barber.is_active ? "opacity-60" : ""}`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={barber.avatar_url} alt={barber.name} />
                    <AvatarFallback className="text-lg">{barber.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{barber.name}</h4>
                      <Badge variant={barber.is_active ? "default" : "secondary"}>
                        {barber.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {barber.specialization && (
                      <p className="text-sm text-muted-foreground">{barber.specialization}</p>
                    )}
                    {barber.phone && (
                      <p className="text-sm text-muted-foreground">{barber.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(barber)}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStatus(barber)}
                  >
                    {barber.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Barber?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {barber.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(barber.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
