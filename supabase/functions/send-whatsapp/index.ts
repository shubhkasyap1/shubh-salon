import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // Assume India (+91) if 10-digit local number
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (raw.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

type Event =
  | "booking_created"
  | "booking_confirmed"
  | "booking_completed"
  | "booking_cancelled";

const bodies: Record<Event, (ctx: any) => string> = {
  booking_created: (c) =>
    `Hi ${c.customerName}, your booking at ${c.saloonName} on ${c.date} at ${c.time} is received. We'll confirm shortly.`,
  booking_confirmed: (c) =>
    `Hi ${c.customerName}, your booking at ${c.saloonName} on ${c.date} at ${c.time} is CONFIRMED. See you there!`,
  booking_completed: (c) =>
    `Thanks for visiting ${c.saloonName}, ${c.customerName}! We'd love your feedback in the app.`,
  booking_cancelled: (c) =>
    `Hi ${c.customerName}, your booking at ${c.saloonName} on ${c.date} at ${c.time} has been cancelled. ${c.refundMessage || ""}`.trim(),
};

async function sendOne(to: string, body: string, from: string, lovableKey: string, twilioKey: string) {
  const params = new URLSearchParams({ To: `whatsapp:${to}`, From: `whatsapp:${from}`, Body: body });
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Twilio WhatsApp failed [${res.status}]:`, text);
    return { ok: false, status: res.status, body: text };
  }
  return { ok: true, body: text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const twilioKey = Deno.env.get("TWILIO_API_KEY");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM") || "+14155238886"; // Twilio sandbox default
    if (!lovableKey || !twilioKey) {
      console.warn("Twilio connector not linked; skipping WhatsApp send");
      return new Response(JSON.stringify({ skipped: "twilio_not_linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { bookingId, event, refundMessage } = await req.json();
    if (!bookingId || !event) throw new Error("bookingId and event required");

    const { data: booking, error } = await admin
      .from("bookings")
      .select("*, saloons(name, owner_id, phone), profiles(name, phone, whatsapp_phone)")
      .eq("id", bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found");

    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("phone, whatsapp_phone")
      .eq("id", booking.saloons.owner_id)
      .maybeSingle();

    const ctx = {
      customerName: booking.profiles?.name || "there",
      saloonName: booking.saloons.name,
      date: booking.booking_date,
      time: booking.time_slot,
      refundMessage,
    };
    const message = bodies[event as Event]?.(ctx);
    if (!message) throw new Error("Unknown event");

    const customerPhone = normalisePhone(
      booking.profiles?.whatsapp_phone || booking.profiles?.phone || booking.customer_phone,
    );
    const ownerPhone = normalisePhone(
      ownerProfile?.whatsapp_phone || ownerProfile?.phone || booking.saloons?.phone,
    );

    const results: Record<string, any> = {};
    if (customerPhone) results.customer = await sendOne(customerPhone, message, from, lovableKey, twilioKey);
    if (ownerPhone && event !== "booking_completed") {
      const ownerMsg = `[${booking.saloons.name}] ${message}`;
      results.owner = await sendOne(ownerPhone, ownerMsg, from, lovableKey, twilioKey);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("send-whatsapp error", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});