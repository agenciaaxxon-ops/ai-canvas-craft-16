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

    // CRITICAL: Verify subscription status and usage limits in BACKEND
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('subscription_status, subscription_plan, monthly_usage, monthly_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar perfil' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if subscription is active
    if (profile.subscription_status !== 'active') {
      console.log('User does not have active subscription:', profile.subscription_status);
      return new Response(
        JSON.stringify({ error: 'Assinatura inativa. Assine um plano para gerar imagens.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get product details to check limits
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('tokens_granted, is_unlimited, name')
      .eq('name', profile.subscription_plan)
      .single();

    if (productError || !product) {
      console.error('Error fetching product:', productError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar detalhes do plano' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check monthly usage limit (unless unlimited plan)
    if (!product.is_unlimited && profile.monthly_usage >= product.tokens_granted) {
      console.log('User reached monthly limit:', { usage: profile.monthly_usage, limit: product.tokens_granted });
      return new Response(
        JSON.stringify({ error: 'Limite mensal atingido. Faça upgrade ou aguarde a renovação.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate image using Google AI Studio (Gemini 2.5 Flash Image)
    const GOOGLE_AI_STUDIO_API_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY');
    if (!GOOGLE_AI_STUDIO_API_KEY) {
      console.error('GOOGLE_AI_STUDIO_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Debug original image URL
    console.log('generate-image original_image_url:', original_image_url);

    const prompt = `Gere uma foto de produto de alta qualidade: ${prompt_product}. Modelo: ${prompt_model}. Cenário: ${prompt_scene}. Estilo realista, iluminação suave, 1024x1024.`;

    // Helper function to convert image URL to base64
    async function fetchImageAsBase64(url: string): Promise<string> {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
        return btoa(binaryString);
      } catch (error) {
        console.error('Error converting image to base64:', error);
        throw error;
      }
    }

    // Helper: truncate long strings for logs
    function truncate(str: string, max = 1200) {
      if (!str) return str as unknown as string;
      return str.length > max ? str.slice(0, max) + '…[truncated]' : str;
    }

    // Helper: summarize AI response without logging large payloads
    function summarizeAiResponse(ai: any) {
      const parts = ai?.candidates?.[0]?.content?.parts || [];
      const partsSummary = parts.map((p: any, idx: number) => ({
        index: idx,
        hasInlineData: Boolean(p?.inline_data || p?.inlineData),
        hasText: typeof p?.text === 'string',
        keys: Object.keys(p || {})
      }));
      return {
        promptFeedback: ai?.promptFeedback ?? null,
        finishReason: ai?.candidates?.[0]?.finishReason || ai?.candidates?.[0]?.finish_reason || null,
        candidatesCount: Array.isArray(ai?.candidates) ? ai.candidates.length : 0,
        partsSummary,
      };
    }

    const buildContent = async (withImage: boolean) => {
      const parts: any[] = [{ text: prompt }];
      if (withImage && original_image_url) {
        try {
          const imageBase64 = await fetchImageAsBase64(original_image_url);
          parts.push({
            inline_data: {
              mime_type: 'image/jpeg',
              data: imageBase64
            }
          });
        } catch (error) {
          console.error('Failed to fetch original image, proceeding without it:', error);
        }
      }
      return parts;
    };

    async function callAI(withImage: boolean) {
      const contentParts = await buildContent(withImage);
      return await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_AI_STUDIO_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: contentParts
            }],
            generationConfig: { responseModalities: ['IMAGE'] }
          }),
        }
      );
    }

    let aiResponse = await callAI(true);
    let responseText: string | null = null;

    if (!aiResponse.ok) {
      responseText = await aiResponse.text();
      console.error('Google AI Studio error:', aiResponse.status, truncate(responseText || '', 1200));

      // Handle rate limits and quota errors
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({
            error: 'Limite de requisições excedido, tente novamente mais tarde.'
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle authentication errors
      if (aiResponse.status === 401 || aiResponse.status === 403) {
        console.error('Google AI Studio authentication error');
        return new Response(
          JSON.stringify({ error: 'Erro de autenticação com Google AI Studio' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Retry once without the image if error suggests image processing issue
      if (responseText?.includes('image') || responseText?.includes('fetch')) {
        console.warn('Retrying AI generation without image due to possible image issue');
        aiResponse = await callAI(false);
        responseText = null; // Reset for the new response
        
        if (!aiResponse.ok) {
          responseText = await aiResponse.text();
          console.error('Google AI Studio final error:', aiResponse.status, responseText);
          return new Response(
            JSON.stringify({ error: 'Erro ao gerar imagem com IA' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Erro ao gerar imagem com IA' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse Google AI Studio response format
    const aiData = await aiResponse.json();
    console.log('AI response summary:', JSON.stringify(summarizeAiResponse(aiData)));
    const parts = aiData?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => (p?.inline_data?.data) || (p?.inlineData?.data));
    const imageBase64: string | undefined = imagePart?.inline_data?.data || imagePart?.inlineData?.data;
    
    if (!imageBase64) {
      console.error('Invalid Google AI Studio response:', JSON.stringify(aiData));
      
      // Check for safety filters
      if (aiData?.promptFeedback?.blockReason || aiData?.candidates?.[0]?.finishReason === 'SAFETY') {
        return new Response(
          JSON.stringify({ error: 'Conteúdo bloqueado por filtros de segurança. Tente com prompts diferentes.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Resposta inválida do provedor de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert base64 to data URL
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

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

    // Increment monthly usage after successful generation
    const { error: usageUpdateErr } = await supabaseClient
      .from('profiles')
      .update({ monthly_usage: profile.monthly_usage + 1 })
      .eq('id', user.id);

    if (usageUpdateErr) {
      console.error('Error updating monthly usage after generation:', usageUpdateErr);
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