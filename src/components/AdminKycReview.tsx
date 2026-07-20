import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Submission {
  id: string;
  saloon_id: string;
  owner_id: string;
  legal_name: string;
  pan_number: string | null;
  gst_number: string | null;
  aadhaar_number: string | null;
  status: string;
  submitted_at: string;
  saloons?: { name: string } | null;
}

interface Review {
  id: string;
  submission_id: string;
  previous_status: string | null;
  new_status: string;
  admin_notes: string | null;
  created_at: string;
  reviewer_id: string;
}

export function AdminKycReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [nextStatus, setNextStatus] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data: subs } = await supabase
      .from("saloon_kyc_submissions")
      .select("*, saloons(name)")
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
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (sub: Submission) => {
    const newStatus = nextStatus[sub.id];
    if (!newStatus) {
      toast({ title: "Choose a decision", variant: "destructive" });
      return;
    }
    const note = notes[sub.id] || null;

    const { error: rErr } = await supabase.from("saloon_kyc_reviews").insert({
      submission_id: sub.id,
      reviewer_id: user!.id,
      previous_status: sub.status,
      new_status: newStatus,
      admin_notes: note,
    });
    if (rErr) {
      toast({ title: "Failed to record review", description: rErr.message, variant: "destructive" });
      return;
    }
    const { error: uErr } = await supabase
      .from("saloon_kyc_submissions")
      .update({ status: newStatus })
      .eq("id", sub.id);
    if (uErr) {
      toast({ title: "Failed to update submission", description: uErr.message, variant: "destructive" });
      return;
    }
    toast({ title: `Marked ${newStatus}` });
    setNotes((n) => ({ ...n, [sub.id]: "" }));
    load();
  };

  const badge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
      approved: "bg-green-500/15 text-green-700 border-green-500/30",
      rejected: "bg-red-500/15 text-red-700 border-red-500/30",
      resubmit: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    };
    return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>KYC review queue</CardTitle>
        <CardDescription>Approve, reject, or ask for resubmission. Every action is logged.</CardDescription>
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
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{s.saloons?.name || "Salon"}</p>
                      <p className="text-sm text-muted-foreground">Legal: {s.legal_name}</p>
                      <p className="text-xs text-muted-foreground">Submitted {format(new Date(s.submitted_at), "PPp")}</p>
                    </div>
                    {badge(s.status)}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mb-3">
                    <div><span className="text-muted-foreground">PAN:</span> {s.pan_number || "—"}</div>
                    <div><span className="text-muted-foreground">GST:</span> {s.gst_number || "—"}</div>
                    <div><span className="text-muted-foreground">Aadhaar:</span> {s.aadhaar_number || "—"}</div>
                  </div>

                  {s.status !== "approved" && (
                    <div className="space-y-2 border-t pt-3">
                      <div className="flex gap-2">
                        <Select value={nextStatus[s.id] || ""} onValueChange={(v) => setNextStatus((n) => ({ ...n, [s.id]: v }))}>
                          <SelectTrigger className="w-48"><SelectValue placeholder="Decision" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Approve</SelectItem>
                            <SelectItem value="rejected">Reject</SelectItem>
                            <SelectItem value="resubmit">Ask for resubmit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={() => act(s)}>Record decision</Button>
                      </div>
                      <Textarea
                        placeholder="Admin notes (visible to owner)"
                        value={notes[s.id] || ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                        rows={2}
                      />
                    </div>
                  )}

                  {subReviews.length > 0 && (
                    <div className="mt-3 border-t pt-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">History</p>
                      {subReviews.map((r) => (
                        <div key={r.id} className="text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{r.previous_status || "pending"} → {r.new_status}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</span>
                          </div>
                          {r.admin_notes && <p className="text-muted-foreground mt-1 pl-2">{r.admin_notes}</p>}
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
  );
}