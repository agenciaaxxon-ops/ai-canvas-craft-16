import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Zap, Crown } from "lucide-react";
import { trackInitiateCheckout } from "@/lib/facebookPixel";

interface Product {
  id: string;
  name: string;
  price_in_cents: number;
  tokens_granted: number;
  is_unlimited: boolean;
}

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredForSignup?: boolean;
}

export function SubscriptionModal({ open, onOpenChange, requiredForSignup = false }: SubscriptionModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadProducts();
    }
  }, [open]);

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("price_in_cents", { ascending: true });

    if (error) {
      console.error("Erro ao carregar planos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os planos disponíveis.",
        variant: "destructive",
      });
      return;
    }

    setProducts(data || []);
  };

  const handleSubscribe = async (productId: string) => {
    setLoading(true);
    setSelectedProduct(productId);

    try {
      const product = products.find(p => p.id === productId);
      
      if (product) {
        trackInitiateCheckout({
          productId: product.id,
          productName: product.name,
          value: product.price_in_cents / 100,
          currency: 'BRL',
        });
      }

      const { data, error } = await supabase.functions.invoke("create-subscription-checkout", {
        body: { product_id: productId },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        if (product) {
          sessionStorage.setItem('pending_purchase', JSON.stringify({
            productId: product.id,
            productName: product.name,
            value: product.price_in_cents / 100,
            tokensGranted: product.tokens_granted,
          }));
        }

        window.open(data.checkout_url, '_blank');
        
        toast({
          title: "QR Code PIX gerado!",
          description: "Uma nova aba foi aberta com o código PIX. Pague para ativar sua assinatura.",
        });
        
        onOpenChange(false);
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (error: any) {
      console.error("Erro ao criar checkout:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível iniciar o processo de pagamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setSelectedProduct(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={requiredForSignup ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-[700px]" onPointerDownOutside={requiredForSignup ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Crown className="h-7 w-7 text-primary" />
            {requiredForSignup ? "Escolha seu Plano" : "Assinar Plano"}
          </DialogTitle>
          <DialogDescription>
            {requiredForSignup 
              ? "Escolha um plano para começar a gerar imagens incríveis com IA!"
              : "Atualize seu plano e continue gerando imagens incríveis!"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`relative flex flex-col p-6 border-2 rounded-xl hover:border-primary transition-all ${
                product.is_unlimited ? 'border-primary bg-primary/5' : ''
              }`}
            >
              {product.is_unlimited && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    MAIS POPULAR
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-2 mb-3">
                {product.is_unlimited ? (
                  <Crown className="h-6 w-6 text-primary" />
                ) : (
                  <Zap className="h-6 w-6 text-primary" />
                )}
                <h3 className="font-bold text-xl">{product.name}</h3>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    R$ {(product.price_in_cents / 100).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>
                    {product.is_unlimited 
                      ? "Imagens Ilimitadas" 
                      : `${product.tokens_granted} imagens/mês`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>IA avançada para geração</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Suporte prioritário</span>
                </div>
                {product.is_unlimited && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="font-semibold">Sem limites!</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleSubscribe(product.id)}
                disabled={loading}
                variant={product.is_unlimited ? "default" : "outline"}
                className="w-full"
                size="lg"
              >
                {loading && selectedProduct === product.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Assinar Agora"
                )}
              </Button>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum plano disponível no momento.
          </div>
        )}

        {requiredForSignup && (
          <p className="text-xs text-center text-muted-foreground">
            * Pagamento obrigatório para ativar sua conta
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
