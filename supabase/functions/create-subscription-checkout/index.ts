import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { product_id, cellphone, taxId } = await req.json();

    if (!product_id) {
      throw new Error("product_id is required");
    }
    if (!cellphone) {
      throw new Error("cellphone is required");
    }
    if (!taxId) {
      throw new Error("taxId is required");
    }

    // Get product details
    const { data: product, error: productError } = await supabaseClient
      .from("products")
      .select("*")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      throw new Error("Product not found");
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    const userEmail = profile?.email || user.email;
    
    // Extract name from email (before @) or use a default
    const userName = userEmail.split('@')[0] || 'Cliente';

    // Sanitize and validate inputs
    const sanitizedCellphone = cellphone.replace(/\D/g, "");
    const sanitizedTaxId = taxId.replace(/\D/g, "");
    if (sanitizedCellphone.length < 10 || sanitizedCellphone.length > 14) {
      throw new Error("Invalid cellphone format");
    }
    if (!(sanitizedTaxId.length === 11 || sanitizedTaxId.length === 14)) {
      throw new Error("Invalid taxId format");
    }

    // Create Abacate Pay checkout for subscription
    const abacateApiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!abacateApiKey) {
      throw new Error("ABACATEPAY_API_KEY not configured");
    }

    const billingPayload = {
      frequency: "MULTIPLE_PAYMENTS",
      methods: ["PIX"],
      products: [
        {
          externalId: product.id,
          name: product.name,
          description: `Assinatura mensal - ${product.name}`,
          quantity: 1,
          price: product.price_in_cents,
        },
      ],
      returnUrl: `${req.headers.get("origin")}/app/plan?success=true`,
      completionUrl: `${req.headers.get("origin")}/app/plan?success=true`,
      customer: {
        name: userName,
        email: userEmail,
        cellphone: sanitizedCellphone,
        taxId: sanitizedTaxId,
      },
    };

    console.log("Creating Abacate billing for subscription:", billingPayload);

    const abacateResponse = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${abacateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(billingPayload),
    });

    if (!abacateResponse.ok) {
      const errorText = await abacateResponse.text();
      console.error("Abacate API error:", errorText);
      throw new Error(`Failed to create Abacate billing: ${errorText}`);
    }

    const abacateData = await abacateResponse.json();
    console.log("Abacate billing created:", abacateData);

    // Record the subscription purchase
    const { error: purchaseError } = await supabaseClient
      .from("purchases")
      .insert({
        user_id: user.id,
        product_id: product_id,
        amount_paid: product.price_in_cents,
        tokens_granted: product.tokens_granted,
        status: "pending",
        abacate_billing_id: abacateData.id,
      });

    if (purchaseError) {
      console.error("Error recording purchase:", purchaseError);
      throw new Error("Failed to record purchase");
    }

    return new Response(
      JSON.stringify({
        checkout_url: abacateData.url,
        billing_id: abacateData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
