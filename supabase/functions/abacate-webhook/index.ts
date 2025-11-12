import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Use the secret from environment to validate HMAC signatures
async function verifyHmacSignature(rawBody: string, signatureFromHeader?: string | null): Promise<boolean> {
  try {
    const secret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') || '';
    if (!secret || !signatureFromHeader) return false;

    // Some providers prefix the signature with the algorithm (e.g., "sha256=...")
    const provided = signatureFromHeader.replace(/^sha256=/i, "");

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));

    // Compare against both base64 and hex encodings to be robust
    const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    const expectedHex = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return provided === expectedBase64 || provided.toLowerCase() === expectedHex;
  } catch (_e) {
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook: accept secret via query param or headers, or a valid HMAC signature
    const expectedSecret = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') || '';
    const url = new URL(req.url);
    const qsSecret = url.searchParams.get('webhookSecret');
    const headerSecret = req.headers.get('X-Webhook-Secret') || req.headers.get('X-Abacatepay-Secret');

    // Read raw body once so we can both verify HMAC and parse JSON
    const rawBody = await req.text();

    // Try common signature headers
    const signature =
      req.headers.get('X-Abacatepay-Signature') ||
      req.headers.get('X-Webhook-Signature') ||
      req.headers.get('X-Signature');

    const isHmacValid = await verifyHmacSignature(rawBody, signature);
    const isSecretOk = expectedSecret
      ? (qsSecret === expectedSecret || headerSecret === expectedSecret)
      : false;

    if (!isSecretOk && !isHmacValid) {
      console.error('Unauthorized webhook: secret/signature validation failed');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    console.log(
      'Received verified Abacate Pay webhook:',
      JSON.stringify({ event: body?.event, via: isHmacValid ? 'hmac' : 'secret' })
    );

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
      let purchase: { user_id: string; tokens_granted: number; status: string; product_id: string; amount_paid: number } | null = null;
      if (externalId) {
        const { data: byExternal } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status, product_id, amount_paid')
          .eq('id', externalId)
          .maybeSingle();
        if (byExternal) purchase = byExternal as any;
      }

      // Fallback to billing id
      if (!purchase && billingId) {
        const { data: byBilling } = await supabaseAdmin
          .from('purchases')
          .select('user_id, tokens_granted, status, product_id, amount_paid')
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
      
      // Track purchase with Facebook Conversions API (server-side, more reliable)
      try {
        const fbAccessToken = Deno.env.get('FACEBOOK_CONVERSIONS_API_TOKEN');
        if (fbAccessToken) {
          await fetch(`https://graph.facebook.com/v18.0/2216647755491538/events`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: [{
                event_name: 'Purchase',
                event_time: Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data: {
                  external_id: purchase.user_id,
                },
                custom_data: {
                  currency: 'BRL',
                  value: purchase.amount_paid / 100,
                  content_ids: [purchase.product_id],
                  content_name: product?.name || 'Subscription',
                },
              }],
              access_token: fbAccessToken,
            }),
          });
          console.log('Facebook Conversions API: Purchase tracked');
        }
      } catch (fbError) {
        console.error('Error tracking Facebook conversion:', fbError);
        // Don't fail the webhook if tracking fails
      }
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
