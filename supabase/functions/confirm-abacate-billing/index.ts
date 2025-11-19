import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const abacateApiKey = Deno.env.get('ABACATEPAY_API_KEY')!;

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('User error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { billing_id } = await req.json();

    if (!billing_id) {
      return new Response(
        JSON.stringify({ error: 'billing_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Confirming billing ID:', billing_id, 'for user:', user.id);

    // Check if purchase exists and belongs to user
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*, products(*)')
      .eq('abacate_billing_id', billing_id)
      .eq('user_id', user.id)
      .single();

    if (purchaseError || !purchase) {
      console.error('Purchase not found:', purchaseError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Compra não encontrada ou não pertence a você' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already completed, return success
    if (purchase.status === 'completed') {
      console.log('Purchase already completed:', billing_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pagamento já foi processado',
          tokens_granted: purchase.tokens_granted 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check payment status with Abacate Pay
    const abacateUrl = `https://api.abacatepay.com/v1/billing/info/${billing_id}`;
    console.log('Checking payment status at:', abacateUrl);

    const abacateResponse = await fetch(abacateUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${abacateApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error('Abacate Pay error:', abacateResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Erro ao consultar status do pagamento' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const billingInfo = await abacateResponse.json();
    console.log('Billing info:', JSON.stringify(billingInfo, null, 2));

    // Check if payment was approved
    if (billingInfo.status === 'PAID' || billingInfo.status === 'APPROVED') {
      console.log('Payment confirmed, processing tokens...');

      // Add tokens to user
      const { error: rpcError } = await supabase.rpc('add_tokens', {
        p_user_id: user.id,
        p_tokens: purchase.tokens_granted
      });

      if (rpcError) {
        console.error('Error adding tokens:', rpcError);
        throw new Error('Erro ao adicionar créditos');
      }

      // Update purchase status
      const { error: updateError } = await supabase
        .from('purchases')
        .update({ status: 'completed' })
        .eq('id', purchase.id);

      if (updateError) {
        console.error('Error updating purchase:', updateError);
        throw new Error('Erro ao atualizar status da compra');
      }

      console.log('✓ Payment processed successfully:', billing_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Créditos ativados com sucesso!',
          tokens_granted: purchase.tokens_granted 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('Payment not confirmed yet. Status:', billingInfo.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Pagamento ainda não confirmado. Status: ${billingInfo.status}`,
          status: billingInfo.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in confirm-abacate-billing:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
