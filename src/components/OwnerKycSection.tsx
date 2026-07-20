import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { FileCheck, Clock, XCircle, CheckCircle2 } from "lucide-react";

interface Submission {
  id: string;
  saloon_id: string;
  legal_name: string;
  pan_number: string | null;
  gst_number: string | null;
  aadhaar_number: string | null;
  status: string;
  submitted_at: string;
}

interface Review {
  id: string;
  submission_id: string;
  previous_status: string | null;
  new_status: string;
  admin_notes: string | null;
  created_at: string;
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string; icon: any }> = {
    pending: { label: "Pending review", className: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", icon: Clock },
    approved: { label: "Approved", className: "bg-green-500/15 text-green-700 border-green-500/30", icon: CheckCircle2 },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700 border-red-500/30", icon: XCircle },
    resubmit: { label: "Resubmit required", className: "bg-orange-500/15 text-orange-700 border-orange-500/30", icon: FileCheck },
  };
  const s = map[status] || map.pending;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={s.className}>
      <Icon className="w-3 h-3 mr-1" />
      {s.label}
    </Badge>
  );
};

export function OwnerKycSection({ saloonId }: { saloonId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ legal_name: "", pan_number: "", gst_number: "", aadhaar_number: "" });

  const load = async () => {
    setLoading(true);
    const { data: subs } = await supabase
      .from("saloon_kyc_submissions")
      .select("*")
      .eq("saloon_id", saloonId)
      .order("submitted_at", { ascending: false });
    const submissions = (subs as Submission[]) || [];
    setSubmissions(submissions);
    if (submissions.length > 0) {
      const { data: revs } = await supabase
        .from("saloon_kyc_reviews")
        .select("*")
        .in("submission_id", submissions.map((s) => s.id))
        .order("created_at", { ascending: false });
      setReviews((revs as Review[]) || []);
    } else {
      setReviews([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (saloonId) load();
  }, [saloonId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.legal_name.trim()) {
      toast({ title: "Legal name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("saloon_kyc_submissions").insert({
      saloon_id: saloonId,
      owner_id: user!.id,
      legal_name: form.legal_name.trim(),
      pan_number: form.pan_number.trim() || null,
      gst_number: form.gst_number.trim() || null,
      aadhaar_number: form.aadhaar_number.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "KYC submitted", description: "An admin will review your submission." });
    setForm({ legal_name: "", pan_number: "", gst_number: "", aadhaar_number: "" });
    load();
  };

  const latest = submissions[0];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>KYC verification</CardTitle>
              <CardDescription>Submit your salon's legal documents for admin review.</CardDescription>
            </div>
            {latest && statusBadge(latest.status)}
          </div>
        </CardHeader>
        <CardContent>
          {(!latest || latest.status === "rejected" || latest.status === "resubmit") && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Legal / business name</Label>
                <Input value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>PAN number</Label>
                  <Input value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label>GST number</Label>
                  <Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div>
                <Label>Aadhaar number (last 4 optional)</Label>
                <Input value={form.aadhaar_number} onChange={(e) => setForm({ ...form, aadhaar_number: e.target.value })} />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Submitting…" : latest ? "Resubmit KYC" : "Submit KYC"}
              </Button>
            </form>
          )}
          {latest && latest.status === "pending" && (
            <p className="text-sm text-muted-foreground">Your submission is under review. You'll be notified once an admin acts on it.</p>
          )}
          {latest && latest.status === "approved" && (
            <p className="text-sm text-green-700">Your salon is verified. New submissions aren't needed unless requested.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
          <CardDescription>Timeline of submissions and admin decisions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="space-y-4">
              {submissions.map((s) => {
                const subReviews = reviews.filter((r) => r.submission_id === s.id);
                return (
                  <div key={s.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{s.legal_name}</p>
                        <p className="text-xs text-muted-foreground">Submitted {format(new Date(s.submitted_at), "PPp")}</p>
                      </div>
                      {statusBadge(s.status)}
                    </div>
                    {subReviews.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-muted pl-4">
                        {subReviews.map((r) => (
                          <div key={r.id} className="text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{r.previous_status || "pending"} → {r.new_status}</Badge>
                              <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</span>
                            </div>
                            {r.admin_notes && <p className="text-muted-foreground mt-1">{r.admin_notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}