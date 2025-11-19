import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TestCheckout() {
  const navigate = useNavigate();

  useEffect(() => {
    const initiateTestCheckout = async () => {
      try {
        // Buscar o produto de teste
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('name', 'Plano de Teste')
          .single();

        if (productError || !product) {
          toast({ 
            title: "Erro", 
            description: "Plano de teste não encontrado.",
            variant: "destructive"
          });
          navigate('/app/plan');
          return;
        }

        // Invocar checkout
        const { data, error } = await supabase.functions.invoke("create-abacate-checkout", {
          body: { product_id: product.id },
        });

        if (error) {
          console.error("Erro ao criar checkout:", error);
          toast({
            title: "Erro",
            description: "Não foi possível iniciar o checkout de teste.",
            variant: "destructive",
          });
          navigate('/app/plan');
          return;
        }

        if (data?.checkout_url) {
          // Detectar mobile para abrir na mesma aba
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          
          if (isMobile) {
            // No mobile, abrir na mesma aba
            window.location.href = data.checkout_url;
          } else {
            // No desktop, abrir em nova aba
            window.open(data.checkout_url, '_blank');
            toast({
              title: "Checkout de teste iniciado",
              description: "Pague R$ 1,00 para receber 5 créditos de teste.",
            });
            navigate('/app/plan');
          }
        } else {
          throw new Error("URL de checkout não retornada");
        }
      } catch (error: any) {
        console.error("Erro no checkout de teste:", error);
        toast({
          title: "Erro",
          description: error.message || "Erro ao processar checkout de teste.",
          variant: "destructive",
        });
        navigate('/app/plan');
      }
    };

    initiateTestCheckout();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Iniciando checkout de teste...</p>
      </div>
    </div>
  );
}
