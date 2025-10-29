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
      // Extract identifiers from multiple possible payload shapes
      const billingId = data?.billing?.id || data?.id || data?.payment?.billingId || data?.pixQrCode?.billingId || null;
      const externalId = data?.billing?.externalId || data?.externalId || data?.payment?.externalId || data?.pixQrCode?.externalId || null;

      console.log('Processing payment:', { billingId, externalId });

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Try resolve purchase by externalId first (our purchase.id)
      let purchase: { user_id: string; tokens_granted: number; status: string } | null = null;
      if (externalId) {
        const { data: byExternal } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status')
          .eq('id', externalId)
          .maybeSingle();
        if (byExternal) purchase = byExternal as any;
      }

      // Fallback to billing id
      if (!purchase && billingId) {
        const { data: byBilling } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status')
          .eq('abacate_billing_id', billingId)
          .maybeSingle();
        if (byBilling) purchase = byBilling as any;
      }

      if (!purchase) {
        console.error('Purchase not found for identifiers:', { billingId, externalId });
        return new Response(
          JSON.stringify({ error: 'Purchase not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (purchase.status === 'completed') {
        console.log('Payment already processed for:', { billingId, externalId });
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
