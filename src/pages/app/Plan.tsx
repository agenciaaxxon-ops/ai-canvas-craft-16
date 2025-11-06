import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image, CheckCircle2, Calendar, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SubscriptionModal } from "@/components/SubscriptionModal";

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

interface GenerationStats {
  total_generations: number;
}

interface SubscriptionInfo {
  plan: string | null;
  status: string;
  end_date: string | null;
  monthly_usage: number;
  is_unlimited: boolean;
  limit: number;
}

export default function Plan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    loadData();
    
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      toast({
        title: "Pagamento processado!",
        description: "Sua assinatura será ativada em alguns instantes. Pode levar até 1 minuto.",
      });
      setSearchParams({});
      setTimeout(() => loadData(), 2000);
    } else if (canceled === 'true') {
      toast({
        title: "Pagamento cancelado",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load subscription info
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, subscription_status, subscription_end_date, monthly_usage")
        .eq("id", user.id)
        .single();

      if (profile) {
        // Get product details
        const { data: product } = await supabase
          .from("products")
          .select("is_unlimited, tokens_granted")
          .ilike("name", `%${profile.subscription_plan || ''}%`)
          .single();

        setSubscription({
          plan: profile.subscription_plan,
          status: profile.subscription_status,
          end_date: profile.subscription_end_date,
          monthly_usage: profile.monthly_usage || 0,
          is_unlimited: product?.is_unlimited || false,
          limit: product?.tokens_granted || 0,
        });
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

      // Load generation stats
      const { count } = await supabase
        .from("generations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setStats({ total_generations: count || 0 });
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

  const isActive = subscription?.status === 'active';

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Minha Assinatura</h1>
          <p className="text-muted-foreground">Gerencie sua assinatura e acompanhe seu uso</p>
        </div>

        {/* Subscription Status Card */}
        <Card className={isActive ? "border-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Status da Assinatura
              </CardTitle>
              <Badge className={isActive ? "bg-green-500" : "bg-gray-500"}>
                {isActive ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isActive && subscription ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold">{subscription.plan}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-4 w-4" />
                    Renova em {subscription.end_date ? formatDate(subscription.end_date) : 'N/A'}
                  </p>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Uso Mensal</span>
                    <span className="text-sm font-semibold">
                      {subscription.is_unlimited 
                        ? `${subscription.monthly_usage} (Ilimitado)` 
                        : `${subscription.monthly_usage} / ${subscription.limit}`
                      }
                    </span>
                  </div>
                  {!subscription.is_unlimited && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((subscription.monthly_usage / subscription.limit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">
                  Você não possui uma assinatura ativa.
                </p>
                <Button onClick={() => setShowSubscriptionModal(true)} size="lg">
                  Ver Planos Disponíveis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Imagens Geradas</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total_generations || 0}</div>
              <p className="text-xs text-muted-foreground">total de gerações</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{subscription?.monthly_usage || 0}</div>
              <p className="text-xs text-muted-foreground">
                {subscription?.is_unlimited ? "imagens geradas" : `de ${subscription?.limit || 0} disponíveis`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Change Plan Button */}
        {isActive && (
          <Card>
            <CardHeader>
              <CardTitle>Alterar Plano</CardTitle>
              <CardDescription>
                Atualize ou cancele sua assinatura a qualquer momento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowSubscriptionModal(true)} variant="outline">
                Gerenciar Assinatura
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
            <CardDescription>Seus pagamentos mais recentes</CardDescription>
          </CardHeader>
          <CardContent>
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Você ainda não realizou nenhum pagamento.
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
                      <p className="text-sm text-muted-foreground">Assinatura Mensal</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SubscriptionModal open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal} />
    </div>
  );
}
