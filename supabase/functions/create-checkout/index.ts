import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { product_id } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      console.error('Error fetching product:', productError);
      return new Response(
        JSON.stringify({ error: 'Produto não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Create Checkout Session
    const origin = req.headers.get('origin') || Deno.env.get('VITE_SUPABASE_URL');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: product.name,
              description: `${product.tokens_granted} tokens para geração de imagens`,
            },
            unit_amount: product.price_in_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/app/generate?success=true`,
      cancel_url: `${origin}/app/generate?canceled=true`,
      metadata: {
        user_id: user.id,
        product_id: product.id,
        tokens_granted: product.tokens_granted.toString(),
      },
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ checkout_url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-checkout function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
