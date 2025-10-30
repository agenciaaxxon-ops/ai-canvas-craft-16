import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { trackPurchase } from "@/lib/facebookPixel";

export default function PurchaseSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    // Get purchase data from URL params
    const value = searchParams.get('value');
    const productId = searchParams.get('product_id');
    const productName = searchParams.get('product_name');
    const tokensGranted = searchParams.get('tokens');
    const transactionId = searchParams.get('transaction_id');

    // Track purchase with Facebook Pixel
    if (value && productId && productName && tokensGranted && transactionId && !hasTracked) {
      trackPurchase({
        value: parseFloat(value),
        currency: 'BRL',
        productId,
        productName,
        tokensGranted: parseInt(tokensGranted),
        transactionId,
      });
      setHasTracked(true);
    }

    // Redirect after 5 seconds
    const timer = setTimeout(() => {
      navigate('/app/generate');
    }, 5000);

    return () => clearTimeout(timer);
  }, [searchParams, navigate, hasTracked]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Pagamento Confirmado!</CardTitle>
          <CardDescription>
            Seus créditos foram adicionados à sua conta com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Você já pode começar a gerar suas imagens!
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Redirecionando em alguns segundos...</span>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/app/generate')} 
            className="w-full"
            size="lg"
          >
            Começar Agora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
