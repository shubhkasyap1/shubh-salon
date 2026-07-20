import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  bookingId: string;
  saloonId: string;
  customerName: string;
  customerPhone: string;
  bookingDate: string;
  timeSlot: string;
  services: string[];
  totalPrice: number;
  paymentMethod: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Received booking notification request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      bookingId,
      saloonId,
      customerName,
      customerPhone,
      bookingDate,
      timeSlot,
      services,
      totalPrice,
      paymentMethod,
    }: BookingNotificationRequest = await req.json();

    console.log("Fetching saloon details for:", saloonId);

    // Get saloon details including owner info
    const { data: saloon, error: saloonError } = await supabase
      .from("saloons")
      .select("name, owner_id")
      .eq("id", saloonId)
      .single();

    if (saloonError || !saloon) {
      console.error("Error fetching saloon:", saloonError);
      throw new Error("Saloon not found");
    }

    // Get owner's email from auth.users
    const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
      saloon.owner_id
    );

    if (ownerError || !ownerData?.user?.email) {
      console.error("Error fetching owner:", ownerError);
      throw new Error("Owner email not found");
    }

    const ownerEmail = ownerData.user.email;
    console.log("Sending email to owner:", ownerEmail);

    const servicesHtml = services.map(s => `<li>${s}</li>`).join("");

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "SaloonBook <onboarding@resend.dev>",
        to: [ownerEmail],
        subject: `New Booking at ${saloon.name}!`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🎉 New Booking!</h1>
            </div>
            
            <div style="background: #fff8f0; padding: 20px; border: 1px solid #fed7aa;">
              <h2 style="color: #ea580c; margin-top: 0;">Booking Details</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Booking ID:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${bookingId.slice(0, 8)}...</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Customer Name:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Phone:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${customerPhone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Date:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${bookingDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Time:</td>
                  <td style="padding: 8px 0; font-weight: bold;">${timeSlot}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment:</td>
                  <td style="padding: 8px 0; font-weight: bold; text-transform: capitalize;">${paymentMethod}</td>
                </tr>
              </table>
              
              <h3 style="color: #ea580c; margin-top: 20px;">Services Booked:</h3>
              <ul style="background: white; padding: 15px 15px 15px 35px; border-radius: 5px; margin: 0;">
                ${servicesHtml}
              </ul>
              
              <div style="background: #ea580c; color: white; padding: 15px; border-radius: 5px; margin-top: 20px; text-align: center;">
                <span style="font-size: 14px;">Total Amount</span><br>
                <span style="font-size: 24px; font-weight: bold;">₹${totalPrice}</span>
              </div>
            </div>
            
            <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 10px 10px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">This is an automated notification from SaloonBook</p>
            </div>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-booking-notification:", message);
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
