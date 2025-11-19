import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Image } from "lucide-react";
import { trackInitiateCheckout } from "@/lib/facebookPixel";

interface Product {
  id: string;
  name: string;
  price_in_cents: number;
  tokens_granted: number;
}

interface TokensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insufficientTokens?: boolean;
}

export function TokensModal({ open, onOpenChange, insufficientTokens = false }: TokensModalProps) {
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
      .order("tokens_granted", { ascending: true });

    if (error) {
      console.error("Erro ao carregar produtos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os planos disponíveis.",
        variant: "destructive",
      });
      return;
    }

    setProducts(data || []);
  };

  const handlePurchase = async (productId: string) => {
    setLoading(true);
    setSelectedProduct(productId);

    try {
      // Find the product data for Facebook Pixel tracking
      const product = products.find(p => p.id === productId);
      
      if (product) {
        // Track InitiateCheckout event with Facebook Pixel
        trackInitiateCheckout({
          productId: product.id,
          productName: product.name,
          value: product.price_in_cents / 100,
          currency: 'BRL',
        });
      }

      const { data, error } = await supabase.functions.invoke("create-abacate-checkout", {
        body: { product_id: productId },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        // Store purchase data for conversion tracking and manual activation
        if (product) {
          sessionStorage.setItem('pending_purchase', JSON.stringify({
            productId: product.id,
            productName: product.name,
            value: product.price_in_cents / 100,
            tokensGranted: product.tokens_granted,
          }));
        }
        if (data.billing_id) {
          sessionStorage.setItem('pending_billing_id', data.billing_id);
        }

        // Detectar mobile para abrir na mesma aba
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
          // No mobile, abrir na mesma aba
          window.location.href = data.checkout_url;
        } else {
          // No desktop, abrir em nova aba
          window.open(data.checkout_url, '_blank');
          
          toast({
            title: "QR Code PIX gerado!",
            description: `Uma nova aba foi aberta. Pague para receber ${product?.tokens_granted} créditos.`,
          });
        }
        
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-6 w-6 text-primary" />
            {insufficientTokens ? "Créditos Insuficientes!" : "Comprar Pacotes de Créditos"}
          </DialogTitle>
          <DialogDescription>
            {insufficientTokens 
              ? "Você não tem créditos suficientes para gerar esta imagem. Escolha um pacote abaixo para continuar:"
              : "Escolha um pacote e recarregue seus créditos para continuar gerando imagens incríveis! Cada geração consome 1 crédito."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {products.map((product) => {
              const isUltra = product.name.includes('Ultra');
              return (
                <div
                  key={product.id}
                  className={`relative flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors ${
                    isUltra ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  {isUltra && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full">
                      MELHOR CUSTO-BENEFÍCIO
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {product.tokens_granted} {product.tokens_granted === 1 ? "crédito" : "créditos"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold">
                      R$ {(product.price_in_cents / 100).toFixed(2)}
                    </span>
                    <Button
                      onClick={() => handlePurchase(product.id)}
                      disabled={loading}
                      variant={selectedProduct === product.id ? "default" : "outline"}
                    >
                      {loading && selectedProduct === product.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        "Comprar"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum plano disponível no momento.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
