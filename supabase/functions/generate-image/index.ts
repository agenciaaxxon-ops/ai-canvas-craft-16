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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt_product, prompt_model, prompt_scene, original_image_url } = await req.json();

    // Check user token balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('token_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.token_balance <= 0) {
      return new Response(
        JSON.stringify({ error: 'Tokens insuficientes' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct 1 token
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ token_balance: profile.token_balance - 1 })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating token balance:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar saldo de tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PLACEHOLDER: Generate image with AI
    // For now, return a placeholder image
    const generated_image_url = `https://placehold.co/1024x1024/667eea/ffffff?text=${encodeURIComponent(prompt_product)}`;

    // Save generation record
    const { error: insertError } = await supabaseClient
      .from('generations')
      .insert({
        user_id: user.id,
        prompt_product,
        prompt_model,
        prompt_scene,
        original_image_url,
        generated_image_url,
      });

    if (insertError) {
      console.error('Error saving generation:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar geração' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ generated_image_url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});