import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { bookingId, reason, refundMode } = await req.json();
    if (!bookingId) throw new Error("bookingId required");

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("*, saloons(name, owner_id)")
      .eq("id", bookingId)
      .single();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (booking.status === "cancelled") throw new Error("Already cancelled");
    if (booking.status === "completed") throw new Error("Cannot cancel completed booking");

    const wasPaidOnline = booking.payment_status === "completed" && booking.payment_method !== "cash";
    const amount = Number(booking.total_price);
    let refundStatus: string = "not_applicable";
    let razorpayRefundId: string | null = null;
    let refundMessage = "Booking cancelled. No refund applicable.";
    let finalRefundMode = "none";

    if (wasPaidOnline && (refundMode === "wallet" || refundMode === "razorpay")) {
      finalRefundMode = refundMode;
      if (refundMode === "wallet") {
        const { error: cErr } = await admin.rpc("credit_wallet", {
          _user_id: userId,
          _amount: amount,
          _booking_id: bookingId,
          _description: `Refund for cancelled booking at ${booking.saloons?.name || "salon"}`,
        });
        if (cErr) throw cErr;
        refundStatus = "completed";
        refundMessage = `₹${amount} credited to your wallet.`;
      } else {
        // Razorpay refund
        const keyId = Deno.env.get("RAZORPAY_KEY_ID");
        const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
        // Find payment record
        const { data: payment } = await admin
          .from("payments")
          .select("razorpay_payment_id")
          .eq("booking_id", bookingId)
          .maybeSingle();
        if (payment?.razorpay_payment_id && keyId && keySecret) {
          const auth = btoa(`${keyId}:${keySecret}`);
          const rzp = await fetch(`https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
            body: JSON.stringify({ amount: Math.round(amount * 100), speed: "normal" }),
          });
          const rjson = await rzp.json();
          if (!rzp.ok) {
            console.error("Razorpay refund failed", rjson);
            refundStatus = "failed";
            refundMessage = `Refund request failed: ${rjson.error?.description || "unknown"}`;
          } else {
            razorpayRefundId = rjson.id;
            refundStatus = "processing";
            refundMessage = `Refund of ₹${amount} initiated to original payment method (5-7 days).`;
          }
        } else {
          refundStatus = "pending";
          refundMessage = "Refund will be processed manually within 5-7 days.";
        }
      }
    }

    const { error: uErr } = await admin
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        refund_mode: finalRefundMode,
        refund_status: refundStatus,
        razorpay_refund_id: razorpayRefundId,
      })
      .eq("id", bookingId);
    if (uErr) throw uErr;

    // Fire status emails (best-effort)
    try {
      await admin.functions.invoke("send-booking-status-email", {
        body: {
          bookingId,
          event: "booking_cancelled",
          refundMessage,
        },
      });
    } catch (e) {
      console.warn("status email failed", e);
    }

    try {
      await admin.functions.invoke("send-whatsapp", {
        body: {
          bookingId,
          event: "booking_cancelled",
          refundMessage,
        },
      });
    } catch (e) {
      console.warn("whatsapp send failed", e);
    }

    return new Response(JSON.stringify({ success: true, refundStatus, refundMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("cancel-booking error", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});