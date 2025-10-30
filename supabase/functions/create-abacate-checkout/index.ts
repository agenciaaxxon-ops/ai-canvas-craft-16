import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1';

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
      console.error('Authentication error:', userError);
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

    // Get user email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single();

    const userEmail = profile?.email || user.email;

    // Initialize Abacate Pay API
    const abacateApiKey = Deno.env.get('ABACATEPAY_API_KEY');
    if (!abacateApiKey) {
      console.error('ABACATEPAY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de pagamento ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Sanitize header value to avoid non-ASCII or CR/LF characters that break Deno Headers ByteString
    const tokenOnly = (abacateApiKey as string)
      .toString()
      .replace(/[\r\n]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
    const bearerValue = `Bearer ${tokenOnly}`;

    // Create billing via Abacate Pay API
    const origin = req.headers.get('origin') || Deno.env.get('SUPABASE_URL');
    const purchaseId = crypto.randomUUID();

    const headers = new Headers();
    try {
      headers.set('Authorization', bearerValue);
    } catch (e) {
      console.error('Failed to set Authorization header, falling back to X-Api-Key');
      headers.set('X-Api-Key', tokenOnly);
    }
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    const payload = {
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: [
        {
          externalId: product.id,
          name: product.name,
          description: `${product.tokens_granted} créditos para geração de imagens`,
          quantity: 1,
          price: product.price_in_cents, // centavos
        }
      ],
      returnUrl: `${origin}/app/plan?success=true`,
      completionUrl: `${origin}/app/plan?success=true`,
      externalId: purchaseId,
      customer: { email: userEmail },
      metadata: {
        user_id: user.id,
        product_id: product.id,
        tokens_granted: product.tokens_granted.toString(),
      }
    };

    const billingResponse = await fetch(`${ABACATEPAY_API_URL}/billing/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!billingResponse.ok) {
      const errorText = await billingResponse.text();
      console.error('Abacate Pay API error:', billingResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar cobrança', provider_status: billingResponse.status, provider_body: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const billingData = await billingResponse.json();
    const billing = billingData?.data || billingData; // fallback if API returns plain object

    console.log('Abacate Pay billing created:', billing?.id, 'url:', billing?.url);

    if (!billing?.id || !billing?.url) {
      console.error('Unexpected Abacate Pay response shape:', JSON.stringify(billingData));
      return new Response(
        JSON.stringify({ error: 'Resposta inesperada da API de pagamento' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record purchase in database as pending
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .insert({
        id: purchaseId,
        user_id: user.id,
        product_id: product.id,
        abacate_billing_id: billing.id,
        amount_paid: product.price_in_cents,
        tokens_granted: product.tokens_granted,
        pix_qr_code: billing.url,
        status: 'pending',
      });

    if (purchaseError) {
      console.error('Error recording purchase:', purchaseError);
    }

    return new Response(
      JSON.stringify({ 
        checkout_url: billing.url,
        billing_id: billing.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-abacate-checkout function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
