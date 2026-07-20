import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, productOrderId, orderType } = await req.json();
    const type = orderType || (productOrderId ? 'product_order' : 'booking');
    
    console.log('Verifying payment:', razorpay_payment_id, 'for order:', razorpay_order_id);

    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeySecret) {
      throw new Error('Razorpay secret not configured');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(razorpayKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = expectedSignature === razorpay_signature;
    console.log('Signature valid:', isValid);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (isValid) {
      if (type === 'booking') {
        await supabase.from('payments').update({
          razorpay_payment_id: razorpay_payment_id,
          status: 'completed',
        }).eq('razorpay_order_id', razorpay_order_id);
        await supabase.from('bookings').update({
          razorpay_payment_id: razorpay_payment_id,
          payment_status: 'completed',
          status: 'confirmed',
        }).eq('id', bookingId);
      } else {
        await supabase.from('product_orders').update({
          razorpay_payment_id: razorpay_payment_id,
          payment_status: 'completed',
          status: 'confirmed',
        }).eq('id', productOrderId);
      }
      console.log('Payment verified');

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      if (type === 'booking') {
        await supabase.from('payments').update({
          status: 'failed',
        }).eq('razorpay_order_id', razorpay_order_id);
      } else {
        await supabase.from('product_orders').update({
          payment_status: 'failed',
        }).eq('id', productOrderId);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment verification failed' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error verifying payment:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
