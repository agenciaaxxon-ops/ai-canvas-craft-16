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

    // Handle payment completed event
    if (event === 'billing.paid' || event === 'payment.approved') {
      const billingId = data.id;
      const metadata = data.metadata || {};

      console.log('Processing payment for billing:', billingId);

      if (!metadata.user_id || !metadata.product_id || !metadata.tokens_granted) {
        console.error('Missing required metadata in billing:', billingId);
        return new Response(
          JSON.stringify({ error: 'Missing metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Check if this payment was already processed
      const { data: existingPurchase } = await supabaseAdmin
        .from('purchases')
        .select('status')
        .eq('abacate_billing_id', billingId)
        .single();

      if (existingPurchase?.status === 'completed') {
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
        .eq('id', metadata.user_id)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching profile:', profileError);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokensToAdd = parseInt(metadata.tokens_granted);
      const newBalance = profile.token_balance + tokensToAdd;

      // Update token balance
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ token_balance: newBalance })
        .eq('id', metadata.user_id);

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
        console.log(`Successfully added ${tokensToAdd} tokens to user ${metadata.user_id}`);
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
