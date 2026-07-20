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
    const { bookingId, productOrderId, orderType, amount } = await req.json();
    const type = orderType || (productOrderId ? 'product_order' : 'booking');
    const refId = type === 'product_order' ? productOrderId : bookingId;

    console.log('Creating Razorpay order:', type, refId, 'amount:', amount);

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    // Create Razorpay order
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${razorpayKeyId}:${razorpayKeySecret}`),
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: refId,
        notes: { ref_id: refId, order_type: type },
      }),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.text();
      console.error('Razorpay error:', errorData);
      throw new Error('Failed to create Razorpay order');
    }

    const orderData = await orderResponse.json();
    console.log('Razorpay order created:', orderData.id);

    // Store payment record
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (type === 'booking') {
      const { error: paymentError } = await supabase.from('payments').insert({
        booking_id: bookingId,
        razorpay_order_id: orderData.id,
        amount: amount,
        currency: 'INR',
        status: 'created',
      });
      if (paymentError) console.error('Error storing payment:', paymentError);
      await supabase.from('bookings').update({
        razorpay_order_id: orderData.id,
      }).eq('id', bookingId);
    } else {
      await supabase.from('product_orders').update({
        razorpay_order_id: orderData.id,
      }).eq('id', productOrderId);
    }

    return new Response(JSON.stringify({
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: razorpayKeyId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error creating order:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
