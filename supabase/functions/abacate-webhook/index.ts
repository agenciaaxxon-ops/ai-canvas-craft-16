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
      let purchase: { user_id: string; tokens_granted: number; status: string; product_id: string } | null = null;
      if (externalId) {
        const { data: byExternal } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status, product_id')
          .eq('id', externalId)
          .maybeSingle();
        if (byExternal) purchase = byExternal as any;
      }

      // Fallback to billing id
      if (!purchase && billingId) {
        const { data: byBilling } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status, product_id')
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

      // Get product info to check if it's unlimited
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('is_unlimited, name')
        .eq('id', purchase.product_id)
        .single();

      if (productError) {
        console.error('Error fetching product:', productError);
      }

      // Update user's subscription
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

      const monthlyResetDate = new Date();
      monthlyResetDate.setMonth(monthlyResetDate.getMonth() + 1);

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          subscription_plan: product?.name || 'unknown',
          subscription_status: 'active',
          subscription_end_date: subscriptionEndDate.toISOString(),
          monthly_usage: 0,
          monthly_reset_date: monthlyResetDate.toISOString()
        })
        .eq('id', purchase.user_id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update subscription' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Update purchase status
      const updateFilter = externalId 
        ? { id: externalId }
        : { abacate_billing_id: billingId };
      
      const { error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .update({ status: 'completed' })
        .match(updateFilter);

      if (purchaseError) {
        console.error('Error updating purchase:', purchaseError);
      } else {
        console.log(`Successfully activated subscription for user ${purchase.user_id}`);
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
