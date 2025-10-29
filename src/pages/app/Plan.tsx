import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Coins, CreditCard, Image } from "lucide-react";
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

interface GenerationStats {
  total_generations: number;
}

export default function Plan() {
  const [tokenBalance, setTokenBalance] = useState(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTokensModal, setShowTokensModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
          <h1 className="text-3xl font-bold">Meu Plano</h1>
          <p className="text-muted-foreground">Gerencie seus tokens e acompanhe suas compras</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tokens Disponíveis</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tokenBalance}</div>
              <p className="text-xs text-muted-foreground">
                {tokenBalance === 1 ? "token restante" : "tokens restantes"}
              </p>
            </CardContent>
          </Card>

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
              <CardTitle className="text-sm font-medium">Compras Realizadas</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchases.length}</div>
              <p className="text-xs text-muted-foreground">transações</p>
            </CardContent>
          </Card>
        </div>

        {/* Buy Tokens Button */}
        <Card>
          <CardHeader>
            <CardTitle>Precisando de mais tokens?</CardTitle>
            <CardDescription>Recarregue agora e continue gerando imagens incríveis!</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowTokensModal(true)} size="lg" className="w-full md:w-auto">
              <Coins className="mr-2 h-4 w-4" />
              Comprar Tokens
            </Button>
          </CardContent>
        </Card>

        {/* Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Compras</CardTitle>
            <CardDescription>Suas transações mais recentes</CardDescription>
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
                      <p className="text-sm text-muted-foreground">
                        +{purchase.tokens_granted} {purchase.tokens_granted === 1 ? "token" : "tokens"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TokensModal open={showTokensModal} onOpenChange={setShowTokensModal} />
    </div>
  );
}
