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

    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError) {
      console.error('auth.getUser error:', userError);
    }

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

    // Check token balance BEFORE generating
    if (profile.token_balance <= 0) {
      console.log('User has insufficient tokens:', profile.token_balance);
      return new Response(
        JSON.stringify({ error: 'Tokens insuficientes' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate image using Lovable AI (Gemini image model)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debug original image URL
    console.log('generate-image original_image_url:', original_image_url);

    const prompt = `Gere uma foto de produto de alta qualidade: ${prompt_product}. Modelo: ${prompt_model}. Cenário: ${prompt_scene}. Estilo realista, iluminação suave, 1024x1024.`;

    const buildContent = (withImage: boolean) => {
      const arr: any[] = [{ type: 'text', text: prompt }];
      if (withImage && original_image_url) {
        arr.push({ type: 'image_url', image_url: { url: original_image_url } });
      }
      return arr;
    };

    async function callAI(withImage: boolean) {
      return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: buildContent(withImage),
            },
          ],
          modalities: ['image', 'text'],
        }),
      });
    }

    let aiResponse = await callAI(true);

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, text);

      if (aiResponse.status === 429 || aiResponse.status === 402) {
        const status = aiResponse.status;
        return new Response(
          JSON.stringify({
            error:
              status === 429
                ? 'Limite de requisições excedido, tente novamente mais tarde.'
                : 'Créditos de IA esgotados. Adicione créditos para continuar.',
          }),
          { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retry once without the image if the provider failed to fetch it
      if (text?.includes('Failed to extract 1 image')) {
        console.warn('Retrying AI generation without image due to extraction failure');
        aiResponse = await callAI(false);
      }

      if (!aiResponse.ok) {
        const t2 = await aiResponse.text();
        console.error('AI gateway final error:', aiResponse.status, t2);
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar imagem com IA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const aiData = await aiResponse.json();
    const dataUrl: string | undefined = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      console.error('Invalid AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do provedor de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert data URL to bytes
    const [meta, base64Data] = dataUrl.split(',');
    const contentType = (meta.match(/data:(.*?);base64/)?.[1]) || 'image/png';
    const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Upload generated image to storage (public bucket)
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    const outFileName = `${user.id}/${Date.now()}.${ext}`;

    const blob = new Blob([binary], { type: contentType });

    const { error: genUploadError } = await supabaseClient
      .storage
      .from('generated-images')
      .upload(outFileName, blob, { contentType });

    if (genUploadError) {
      console.error('Error uploading generated image:', genUploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar imagem gerada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: pub } = supabaseClient
      .storage
      .from('generated-images')
      .getPublicUrl(outFileName);
    const generated_image_url = pub.publicUrl;

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

    // Deduct 1 token after successful generation
    const { error: tokenUpdateErr } = await supabaseClient
      .from('profiles')
      .update({ token_balance: profile.token_balance - 1 })
      .eq('id', user.id);

    if (tokenUpdateErr) {
      console.error('Error updating token balance after generation:', tokenUpdateErr);
      // We proceed but log the error; user received value
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