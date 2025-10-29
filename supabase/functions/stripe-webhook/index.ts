import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      event = JSON.parse(body);
    }

    console.log('Received Stripe event:', event.type);

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata;

      if (!metadata?.user_id || !metadata?.product_id || !metadata?.tokens_granted) {
        console.error('Missing required metadata in session:', session.id);
        return new Response(
          JSON.stringify({ error: 'Missing metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

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

      // Record purchase
      const { error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .insert({
          user_id: metadata.user_id,
          product_id: metadata.product_id,
          stripe_session_id: session.id,
          amount_paid: session.amount_total || 0,
          tokens_granted: tokensToAdd,
          status: 'completed',
        });

      if (purchaseError) {
        console.error('Error recording purchase:', purchaseError);
        // Don't return error as tokens were already added
      }

      console.log(`Successfully added ${tokensToAdd} tokens to user ${metadata.user_id}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in stripe-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
