import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Event = "booking_confirmed" | "booking_completed" | "booking_cancelled";

const templates: Record<Event, { subject: (s: string) => string; heading: string; color: string; body: (ctx: any) => string }> = {
  booking_confirmed: {
    subject: (s) => `Your booking at ${s} is confirmed`,
    heading: "✅ Booking Confirmed",
    color: "#10b981",
    body: (ctx) => `<p>Hi ${ctx.customerName}, your booking at <b>${ctx.saloonName}</b> is confirmed.</p>
      <p>See you on <b>${ctx.bookingDate}</b> at <b>${ctx.timeSlot}</b>.</p>`,
  },
  booking_completed: {
    subject: (s) => `Thanks for visiting ${s}!`,
    heading: "🌟 Service Completed",
    color: "#f59e0b",
    body: (ctx) => `<p>Hi ${ctx.customerName}, thanks for visiting <b>${ctx.saloonName}</b>.</p>
      <p>We'd love your feedback — leave a review on the app.</p>`,
  },
  booking_cancelled: {
    subject: (s) => `Your booking at ${s} was cancelled`,
    heading: "❌ Booking Cancelled",
    color: "#ef4444",
    body: (ctx) => `<p>Hi ${ctx.customerName}, your booking at <b>${ctx.saloonName}</b> on ${ctx.bookingDate} at ${ctx.timeSlot} has been cancelled.</p>
      ${ctx.refundMessage ? `<p><b>Refund:</b> ${ctx.refundMessage}</p>` : ""}`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { bookingId, event, refundMessage } = await req.json();
    const t = templates[event as Event];
    if (!t) throw new Error("Unknown event");

    const { data: booking, error } = await admin
      .from("bookings")
      .select("*, saloons(name, owner_id), services(name), profiles(name)")
      .eq("id", bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found");

    const { data: customer } = await admin.auth.admin.getUserById(booking.user_id);
    const { data: owner } = await admin.auth.admin.getUserById(booking.saloons.owner_id);

    const ctx = {
      customerName: booking.profiles?.name || "there",
      saloonName: booking.saloons.name,
      bookingDate: booking.booking_date,
      timeSlot: booking.time_slot,
      refundMessage,
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${t.color}; padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">${t.heading}</h1>
        </div>
        <div style="background: #fff8f0; padding: 20px; border: 1px solid #fed7aa;">
          ${t.body(ctx)}
          <p style="color:#666;font-size:12px;margin-top:20px;">Booking ID: ${bookingId.slice(0,8)}</p>
        </div>
        <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; font-size: 12px;">
          SaloonBook
        </div>
      </div>`;

    const recipients = [customer?.user?.email, owner?.user?.email].filter(Boolean) as string[];
    if (recipients.length === 0) return new Response(JSON.stringify({ skipped: "no recipients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "SaloonBook <onboarding@resend.dev>",
        to: recipients,
        subject: t.subject(booking.saloons.name),
        html,
      }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ success: res.ok, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("send-booking-status-email error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});