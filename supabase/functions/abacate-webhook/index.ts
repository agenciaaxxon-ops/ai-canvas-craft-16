import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log('Received Abacate Pay webhook:', JSON.stringify(body));

    // Abacate Pay webhook structure
    const { event, data } = body;

    if (!event || !data) {
      console.error('Invalid webhook payload');
      return new Response(
        JSON.stringify({ error: 'Invalid payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (event === 'billing.paid' || event === 'payment.approved') {
      // Extract billingId from multiple possible payload shapes
      const billingId = data?.billing?.id || data?.id || data?.payment?.billingId || data?.pixQrCode?.billingId;

      console.log('Processing payment, resolved billingId:', billingId);

      if (!billingId) {
        console.error('Missing billing id in webhook payload:', JSON.stringify(body));
        return new Response(
          JSON.stringify({ error: 'Missing billing id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Find purchase by billing id to get user and tokens
      const { data: purchase, error: purchaseFindErr } = await supabaseAdmin
        .from('purchases')
        .select('user_id, tokens_granted, status')
        .eq('abacate_billing_id', billingId)
        .single();

      if (purchaseFindErr || !purchase) {
        console.error('Purchase not found for billing id:', billingId, purchaseFindErr);
        return new Response(
          JSON.stringify({ error: 'Purchase not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (purchase.status === 'completed') {
        console.log('Payment already processed for billing:', billingId);
        return new Response(
          JSON.stringify({ received: true, message: 'Already processed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get current token balance
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('token_balance')
        .eq('id', purchase.user_id)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokensToAdd = Number(purchase.tokens_granted || 0);
      const newBalance = profile.token_balance + tokensToAdd;

      // Update token balance
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ token_balance: newBalance })
        .eq('id', purchase.user_id);

      if (updateError) {
        console.error('Error updating token balance:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update tokens' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update purchase status
      const { error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .update({ status: 'completed' })
        .eq('abacate_billing_id', billingId);

      if (purchaseError) {
        console.error('Error updating purchase:', purchaseError);
      } else {
        console.log(`Successfully added ${tokensToAdd} tokens to user ${purchase.user_id}`);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in abacate-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
