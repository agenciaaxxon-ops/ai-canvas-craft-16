import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Image } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price_in_cents: number;
  tokens_granted: number;
}

interface TokensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TokensModal({ open, onOpenChange }: TokensModalProps) {
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
      const { data, error } = await supabase.functions.invoke("create-abacate-checkout", {
        body: { product_id: productId },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        // Abrir em nova aba para facilitar o pagamento PIX
        window.open(data.checkout_url, '_blank');
        
        toast({
          title: "QR Code PIX gerado!",
          description: "Uma nova aba foi aberta com o código PIX. Pague para receber seus créditos.",
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-6 w-6 text-primary" />
            Comprar Créditos de Imagem
          </DialogTitle>
          <DialogDescription>
            Escolha um plano e recarregue seus créditos para continuar gerando imagens incríveis!
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
            >
              <div>
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {product.tokens_granted} {product.tokens_granted === 1 ? "imagem" : "imagens"}
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
          ))}
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
