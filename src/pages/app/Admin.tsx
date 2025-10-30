import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, DollarSign, TrendingUp, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserData {
  id: string;
  email: string;
  token_balance: number;
  created_at: string;
  total_spent: number;
  total_purchases: number;
}

interface Stats {
  totalUsers: number;
  totalRevenue: number;
  totalGenerations: number;
}

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalRevenue: 0, totalGenerations: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      navigate("/app/generate");
      toast.error("Acesso negado");
    }
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load users with their purchase data
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, token_balance, created_at');

      if (profilesError) throw profilesError;

      // Load purchase data for each user
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select('user_id, amount_paid, status')
        .eq('status', 'completed');

      if (purchasesError) throw purchasesError;

      // Load generation stats
      const { count: generationsCount } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true });

      // Calculate aggregated data
      const userPurchases = purchasesData.reduce((acc, purchase) => {
        if (!acc[purchase.user_id]) {
          acc[purchase.user_id] = { total: 0, count: 0 };
        }
        acc[purchase.user_id].total += purchase.amount_paid;
        acc[purchase.user_id].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);

      const usersWithStats = profilesData.map(profile => ({
        ...profile,
        total_spent: userPurchases[profile.id]?.total || 0,
        total_purchases: userPurchases[profile.id]?.count || 0,
      }));

      setUsers(usersWithStats);

      // Calculate stats
      const totalRevenue = purchasesData.reduce((sum, p) => sum + p.amount_paid, 0);
      setStats({
        totalUsers: profilesData.length,
        totalRevenue,
        totalGenerations: generationsCount || 0,
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUser || !creditsToAdd) return;

    const credits = parseInt(creditsToAdd);
    if (isNaN(credits) || credits <= 0) {
      toast.error("Digite um número válido de créditos");
      return;
    }

    try {
      const newBalance = selectedUser.token_balance + credits;

      const { error } = await supabase
        .from('profiles')
        .update({ token_balance: newBalance })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(`${credits} créditos adicionados para ${selectedUser.email}`);
      setShowDialog(false);
      setCreditsToAdd("");
      setSelectedUser(null);
      loadData();
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error("Erro ao adicionar créditos");
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (adminLoading || !isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Painel Administrativo</h1>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Cadastros no sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">De todas as compras</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gerações</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGenerations}</div>
            <p className="text-xs text-muted-foreground">Total de imagens geradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Gerencie os usuários e seus créditos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Gasto Total</TableHead>
                <TableHead>Compras</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{user.token_balance}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(user.total_spent)}</TableCell>
                  <TableCell>{user.total_purchases}</TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Créditos
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Créditos</DialogTitle>
            <DialogDescription>
              Adicione créditos para {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Saldo atual: {selectedUser?.token_balance} créditos</label>
              <Input
                type="number"
                placeholder="Quantidade de créditos"
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCredits}>
              Adicionar Créditos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
