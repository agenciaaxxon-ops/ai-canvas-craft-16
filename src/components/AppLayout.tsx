import { useEffect, useState } from "react";
import { Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Image, LogOut, Coins } from "lucide-react";

const AppLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ email: string; token_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("email, token_balance")
      .eq("id", user.id)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/app" className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">Estúdio AI</span>
              </Link>
              
              <nav className="hidden md:flex items-center gap-4">
                <Button variant="ghost" asChild>
                  <Link to="/app/generate" className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    Gerar Imagem
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/app/gallery" className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Minha Galeria
                  </Link>
                </Button>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <Coins className="h-4 w-4 text-primary" />
                <span className="font-semibold">{profile?.token_balance ?? 0}</span>
                <span className="text-xs text-muted-foreground">tokens</span>
              </div>
              
              <div className="hidden md:block text-sm text-muted-foreground">
                {profile?.email}
              </div>

              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;