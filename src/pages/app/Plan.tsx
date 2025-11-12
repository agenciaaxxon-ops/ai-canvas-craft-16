import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, ShoppingCart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TokensModal } from "@/components/TokensModal";

interface Purchase {
  id: string;
  created_at: string;
  tokens_granted: number;
  amount_paid: number;
  status: string;
  products: {
    name: string;
  };
}

export default function Plan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [activating, setActivating] = useState(false);
  const requiredPurchase = searchParams.get('required') === 'true';

  useEffect(() => {
    loadData();
    
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      toast({
        title: "Pagamento processado!",
        description: "Verificando adição de créditos...",
      });
      setSearchParams({});
      startPollingActivation();
    } else if (canceled === 'true') {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
      setSearchParams({});
    }

    // Abrir modal automaticamente se required=true
    if (requiredPurchase) {
      setShowTokensModal(true);
    }
  }, [searchParams, setSearchParams, requiredPurchase]);

  const startPollingActivation = async () => {
    setActivating(true);
    const maxAttempts = 12;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setActivating(false);
        toast({
          title: "Aguardando confirmação",
          description: "O pagamento pode levar alguns minutos para ser confirmado. Use o botão 'Já paguei' para verificar manualmente.",
        });
        return;
      }

      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts}`);

      try {
        const billingId = sessionStorage.getItem('pending_billing_id');
        const { data, error } = await supabase.functions.invoke('confirm-abacate-billing', {
          body: billingId ? { billing_id: billingId } : undefined,
        });
        
        if (error) throw error;

        console.log('Activation check result:', data);

        if (data?.activated) {
          setActivating(false);
          await loadData();
          toast({
            title: "Créditos adicionados!",
            description: `${data.credits_added} créditos foram adicionados à sua conta.`,
          });
          return;
        }

        setTimeout(poll, 5000);
      } catch (error: any) {
        console.error('Error checking activation:', error);
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  const handleManualActivation = async () => {
    setActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-abacate-billing');
      
      if (error) throw error;

      if (data?.activated) {
        await loadData();
        toast({
          title: "Créditos adicionados!",
          description: `${data.credits_added} créditos foram adicionados à sua conta.`,
        });
      } else {
        toast({
          title: "Pagamento pendente",
          description: data?.message || "O pagamento ainda não foi confirmado.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error activating:', error);
      toast({
        title: "Erro",
        description: "Não foi possível verificar o pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load token balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("token_balance")
        .eq("id", user.id)
        .single();

      if (profile) {
        setTokenBalance(profile.token_balance);
      }

      // Load purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select(`
          id,
          created_at,
          tokens_granted,
          amount_paid,
          status,
          products (name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar seus dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluído";
      case "pending":
        return "Pendente";
      case "failed":
        return "Falhou";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Meus Créditos</h1>
          <p className="text-muted-foreground">Gerencie seus créditos e acompanhe seu histórico</p>
        </div>

        {/* Required Purchase Banner */}
        {requiredPurchase && tokenBalance === 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="text-center space-y-3">
                <ShoppingCart className="h-12 w-12 mx-auto text-primary" />
                <h3 className="text-lg font-semibold">Complete sua primeira compra!</h3>
                <p className="text-muted-foreground">
                  Para começar a gerar imagens, você precisa adquirir créditos.
                </p>
                <Button onClick={() => setShowTokensModal(true)} size="lg" variant="hero">
                  Ver Pacotes Disponíveis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Balance Card */}
        <Card className={tokenBalance > 0 ? "border-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Seu Saldo
              </CardTitle>
              {tokenBalance > 0 && (
                <Badge className="bg-green-500">Ativo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-5xl font-bold gradient-text">{tokenBalance}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  créditos disponíveis
                </p>
              </div>
              
              <div className="pt-4 border-t space-y-2">
                <p className="text-sm text-muted-foreground">
                  • Cada geração de imagem consome 1 crédito
                </p>
                <p className="text-sm text-muted-foreground">
                  • Créditos não expiram e são cumulativos
                </p>
                <p className="text-sm text-muted-foreground">
                  • Compre mais créditos a qualquer momento
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={() => setShowTokensModal(true)} size="lg" className="flex-1">
                  Comprar Mais Créditos
                </Button>
                <Button 
                  onClick={handleManualActivation} 
                  variant="outline" 
                  size="lg"
                  disabled={activating}
                  className="flex-1"
                >
                  {activating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Já paguei, verificar agora'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Compras</CardTitle>
            <CardDescription>Suas compras de créditos mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Você ainda não realizou nenhuma compra.
              </div>
            ) : (
              <div className="space-y-4">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{purchase.products.name}</h4>
                        <Badge className={getStatusColor(purchase.status)}>
                          {getStatusLabel(purchase.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatDate(purchase.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {(purchase.amount_paid / 100).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{purchase.tokens_granted} créditos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TokensModal 
        open={showTokensModal} 
        onOpenChange={setShowTokensModal}
        insufficientTokens={requiredPurchase && tokenBalance === 0}
      />
    </div>
  );
}
