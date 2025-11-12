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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mode = (Deno.env.get('ABACATEPAY_MODE') || '').toLowerCase();
    const apiKeyDev = Deno.env.get('ABACATEPAY_API_KEY_DEV');
    const apiKeyProd = Deno.env.get('ABACATEPAY_API_KEY');
    const abacateApiKey = mode === 'dev' ? (apiKeyDev || apiKeyProd) : (apiKeyProd || apiKeyDev);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ activated: false, status: 'unauthorized', message: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ activated: false, status: 'unauthorized', message: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking billing for user:', user.id);

    // Parse body for billing_id (optional)
    let billingId: string | null = null;
    try {
      const body = await req.json();
      billingId = body.billing_id || null;
    } catch {
      // No body or invalid JSON, proceed without billing_id
    }

    // Find pending purchase
    let purchaseQuery = supabase
      .from('purchases')
      .select('*, products(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .not('abacate_billing_id', 'is', null);

    if (billingId) {
      purchaseQuery = purchaseQuery.eq('abacate_billing_id', billingId);
    } else {
      purchaseQuery = purchaseQuery.order('created_at', { ascending: false }).limit(1);
    }

    const { data: purchases, error: purchaseError } = await purchaseQuery;

    if (purchaseError || !purchases || purchases.length === 0) {
      console.log('No pending purchase found for user:', user.id);
      return new Response(
        JSON.stringify({ 
          activated: false, 
          status: 'not_found', 
          message: 'Nenhuma compra pendente encontrada' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const purchase = purchases[0];
    const purchaseBillingId = purchase.abacate_billing_id;

    console.log('Checking Abacate billing:', purchaseBillingId);

    // Call Abacate API to check payment status (correct endpoint)
    const abacateResponse = await fetch(
      `https://api.abacatepay.com/v1/pixQrCode/check?id=${purchaseBillingId}`,
      {
        headers: {
          'Authorization': `Bearer ${abacateApiKey}`,
        },
      }
    );

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error('Abacate API error:', errorText);
      return new Response(
        JSON.stringify({ 
          activated: false, 
          status: 'pending', 
          message: 'Não foi possível consultar o status no momento' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const billingData = await abacateResponse.json();
    console.log('Abacate billing response:', billingData);
    
    // Response format: { data: { status: "PAID" | "PENDING" | "EXPIRED" | "CANCELLED" | "REFUNDED" }, error: null }
    const paymentStatus = billingData.data?.status;
    console.log('Payment status:', paymentStatus);

    // Check if paid
    const isPaid = paymentStatus === 'PAID';

    if (!isPaid) {
      return new Response(
        JSON.stringify({ 
          activated: false, 
          status: 'pending', 
          message: paymentStatus === 'EXPIRED' ? 'Pagamento expirado' : 
                   paymentStatus === 'CANCELLED' ? 'Pagamento cancelado' :
                   'Pagamento ainda pendente'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment confirmed! Add credits to user
    console.log('Payment confirmed, adding credits for user:', user.id);

    const product = purchase.products;
    
    // Adicionar créditos ao usuário usando a função add_tokens
    const { error: addTokensError } = await supabase
      .rpc('add_tokens', {
        p_user_id: user.id,
        p_tokens: product.tokens_granted
      });

    if (addTokensError) {
      console.error('Error adding tokens:', addTokensError);
      throw addTokensError;
    }

    console.log(`Added ${product.tokens_granted} credits to user ${user.id}`);

    // Update purchase to completed
    const { error: purchaseUpdateError } = await supabase
      .from('purchases')
      .update({ status: 'completed' })
      .eq('id', purchase.id);

    if (purchaseUpdateError) {
      console.error('Error updating purchase:', purchaseUpdateError);
    }

    console.log('Credits added successfully for user:', user.id);

    return new Response(
      JSON.stringify({ 
        activated: true, 
        status: 'activated', 
        message: 'Créditos adicionados com sucesso!',
        credits_added: product.tokens_granted
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in confirm-abacate-billing:', error);
    return new Response(
      JSON.stringify({ 
        activated: false, 
        status: 'error', 
        message: 'Erro ao processar confirmação',
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
