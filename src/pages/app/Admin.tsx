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
import { Users, DollarSign, TrendingUp, Plus, Search, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  newUsersInPeriod: number;
  revenueInPeriod: number;
  generationsInPeriod: number;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';
type SortBy = 'created_at' | 'token_balance' | 'total_spent' | 'total_purchases';

export default function Admin() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<Stats>({ 
    totalUsers: 0, 
    totalRevenue: 0, 
    totalGenerations: 0,
    newUsersInPeriod: 0,
    revenueInPeriod: 0,
    generationsInPeriod: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [searchEmail, setSearchEmail] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>('created_at');
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [allGenerations, setAllGenerations] = useState<any[]>([]);

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

  useEffect(() => {
    filterAndSortUsers();
  }, [users, periodFilter, searchEmail, sortBy]);

  useEffect(() => {
    calculateStats();
  }, [users, periodFilter]);

  const getDateForPeriod = (period: PeriodFilter): Date | null => {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return weekAgo;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        return monthAgo;
      case 'all':
      default:
        return null;
    }
  };

  const filterAndSortUsers = () => {
    let filtered = [...users];

    // Apply search filter
    if (searchEmail) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchEmail.toLowerCase())
      );
    }

    // Apply period filter
    const periodDate = getDateForPeriod(periodFilter);
    if (periodDate) {
      filtered = filtered.filter(user => 
        new Date(user.created_at) >= periodDate
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'token_balance':
          return b.token_balance - a.token_balance;
        case 'total_spent':
          return b.total_spent - a.total_spent;
        case 'total_purchases':
          return b.total_purchases - a.total_purchases;
        default:
          return 0;
      }
    });

    setFilteredUsers(filtered);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Use RPC function for efficient data aggregation
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_admin_stats');

      if (rpcError) throw rpcError;

      // The RPC returns the JSON object directly
      const statsData = (rpcData as any) || { users: [], purchases: [], generations: [] };
      
      setUsers(statsData.users || []);
      setAllPurchases(statsData.purchases || []);
      setAllGenerations(statsData.generations || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const periodDate = getDateForPeriod(periodFilter);
    
    // Calculate total stats
    const totalRevenue = allPurchases.reduce((sum, p) => sum + p.amount_paid, 0);
    const totalGenerations = allGenerations.length;
    
    // Calculate period-specific stats
    let newUsersInPeriod = users.length;
    let revenueInPeriod = totalRevenue;
    let generationsInPeriod = totalGenerations;

    if (periodDate) {
      newUsersInPeriod = users.filter(u => 
        new Date(u.created_at) >= periodDate
      ).length;

      revenueInPeriod = allPurchases
        .filter(p => new Date(p.created_at) >= periodDate)
        .reduce((sum, p) => sum + p.amount_paid, 0);

      generationsInPeriod = allGenerations.filter(g => 
        new Date(g.created_at) >= periodDate
      ).length;
    }

    setStats({
      totalUsers: users.length,
      totalRevenue,
      totalGenerations,
      newUsersInPeriod,
      revenueInPeriod,
      generationsInPeriod,
    });
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

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'today': return 'hoje';
      case 'week': return 'nos últimos 7 dias';
      case 'month': return 'nos últimos 30 dias';
      case 'all': return 'total';
      default: return '';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Período:</span>
        </div>
      </div>

      {/* Period Filter Tabs */}
      <Tabs value={periodFilter} onValueChange={(value) => setPeriodFilter(value as PeriodFilter)} className="mb-6">
        <TabsList>
          <TabsTrigger value="today">Hoje</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="month">Mês</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsersInPeriod}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados {getPeriodLabel()}
            </p>
            {periodFilter !== 'all' && (
              <p className="text-xs text-muted-foreground mt-1">
                Total: {stats.totalUsers}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.revenueInPeriod)}</div>
            <p className="text-xs text-muted-foreground">
              Gerada {getPeriodLabel()}
            </p>
            {periodFilter !== 'all' && (
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(stats.totalRevenue)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gerações</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.generationsInPeriod}</div>
            <p className="text-xs text-muted-foreground">
              Criadas {getPeriodLabel()}
            </p>
            {periodFilter !== 'all' && (
              <p className="text-xs text-muted-foreground mt-1">
                Total: {stats.totalGenerations}
              </p>
            )}
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
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Data de Cadastro</SelectItem>
                <SelectItem value="token_balance">Créditos</SelectItem>
                <SelectItem value="total_spent">Gasto Total</SelectItem>
                <SelectItem value="total_purchases">Nº de Compras</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
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
              )))}
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
