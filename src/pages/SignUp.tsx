import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import fotosmart from "@/assets/fotosmart-logo.svg";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });

    if (error) {
      // Se o usuário já existe, tenta fazer login
      if (error.message.includes("User already registered") || error.message.includes("already exists")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          toast({
            title: "Erro ao acessar conta",
            description: "Você já tem uma conta, mas a senha está incorreta. Tente fazer login.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

      // Login bem-sucedido, verificar se tem créditos
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("token_balance")
            .eq("id", user.id)
            .single();

          if (!profile || profile.token_balance === 0) {
            toast({
              title: "Bem-vindo de volta!",
              description: "Você já tem uma conta. Adquira créditos para começar a gerar imagens.",
            });
            setLoading(false);
            navigate("/app/plan?required=true");
          } else {
            toast({
              title: "Conta já ativa!",
              description: "Você já tem créditos. Redirecionando...",
            });
            setLoading(false);
            navigate("/app");
          }
        }
      } else {
        toast({
          title: "Erro ao criar conta",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
      }
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Agora adquira créditos para começar.",
      });
      setLoading(false);
      navigate("/app/plan?required=true");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-6 group">
            <img src={fotosmart} alt="FotoSmart" className="h-12 w-12 transition-transform group-hover:scale-110" />
            <span className="text-3xl font-bold gradient-text">FotoSmart</span>
          </Link>
          <h2 className="text-3xl font-bold">Crie sua conta</h2>
          <p className="text-muted-foreground mt-2">
            Escolha seu plano e comece a gerar
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6 glass-card p-8 rounded-xl">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="glass-card"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="glass-card"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 6 caracteres
            </p>
          </div>

          <Button
            type="submit"
            variant="hero"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link to="/sign-in" className="text-primary hover:underline">
              Fazer login
            </Link>
          </p>
        </form>

      </div>
    </div>
  );
};

export default SignUp;