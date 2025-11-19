import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'pending' | 'error'>('checking');
  const [message, setMessage] = useState('Verificando pagamento...');

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    const billingId = searchParams.get('billing_id') || sessionStorage.getItem('pending_billing_id');
    
    if (!billingId) {
      setStatus('error');
      setMessage('ID de pagamento não encontrado');
      return;
    }

    try {
      // Verificar se o pagamento já foi processado
      const { data: purchase, error } = await supabase
        .from('purchases')
        .select('*, products(*)')
        .eq('abacate_billing_id', billingId)
        .single();

      if (error) {
        console.error('Erro ao buscar compra:', error);
        setStatus('pending');
        setMessage('Aguardando confirmação do pagamento...');
        return;
      }

      if (purchase.status === 'completed') {
        setStatus('success');
        setMessage(`✓ Pagamento confirmado! ${purchase.tokens_granted} créditos adicionados.`);
        toast({
          title: "Pagamento confirmado!",
          description: `Você recebeu ${purchase.tokens_granted} créditos.`,
        });
        
        // Limpar dados temporários
        sessionStorage.removeItem('pending_billing_id');
        sessionStorage.removeItem('pending_purchase');
        
        setTimeout(() => navigate('/app/generate'), 2000);
      } else {
        setStatus('pending');
        setMessage('Pagamento ainda não confirmado. Isso pode levar alguns minutos.');
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      setStatus('error');
      setMessage('Erro ao verificar status do pagamento');
    }
  };

  const handleManualActivation = async () => {
    const billingId = searchParams.get('billing_id') || sessionStorage.getItem('pending_billing_id');
    
    if (!billingId) {
      toast({
        title: "Erro",
        description: "ID de pagamento não encontrado",
        variant: "destructive"
      });
      return;
    }

    try {
      setStatus('checking');
      setMessage('Verificando pagamento...');

      const { data, error } = await supabase.functions.invoke('confirm-abacate-billing', {
        body: { billing_id: billingId }
      });

      if (error) throw error;

      if (data?.success) {
        setStatus('success');
        setMessage(`✓ Créditos ativados! ${data.tokens_granted} créditos adicionados.`);
        toast({
          title: "Créditos ativados!",
          description: `Você recebeu ${data.tokens_granted} créditos.`,
        });
        
        sessionStorage.removeItem('pending_billing_id');
        sessionStorage.removeItem('pending_purchase');
        
        setTimeout(() => navigate('/app/generate'), 2000);
      } else {
        setStatus('pending');
        setMessage(data?.message || 'Pagamento ainda não foi confirmado pela Abacate Pay');
      }
    } catch (error: any) {
      console.error('Erro ao ativar créditos:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível ativar os créditos",
        variant: "destructive"
      });
      setStatus('error');
      setMessage('Erro ao ativar créditos. Contate o suporte.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {status === 'checking' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h2 className="text-2xl font-bold">{message}</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-green-500">{message}</h2>
            <p className="text-muted-foreground">Redirecionando...</p>
          </>
        )}

        {status === 'pending' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-yellow-500 mx-auto" />
            <h2 className="text-2xl font-bold">{message}</h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Se você já pagou, clique no botão abaixo para tentar ativar seus créditos manualmente.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleManualActivation} variant="default">
                  Ativar Créditos
                </Button>
                <Button onClick={checkPaymentStatus} variant="outline">
                  Verificar Novamente
                </Button>
              </div>
              <Button 
                onClick={() => navigate('/app/plan')} 
                variant="ghost"
                className="w-full"
              >
                Voltar
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold text-red-500">{message}</h2>
            <Button onClick={() => navigate('/app/plan')} variant="outline">
              Voltar para Planos
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
