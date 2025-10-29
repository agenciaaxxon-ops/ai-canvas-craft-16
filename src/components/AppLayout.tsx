import { useEffect, useState } from "react";
import { Navigate, Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, Image, Plus } from "lucide-react";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { TokensModal } from "@/components/TokensModal";

const AppLayout = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ email: string; token_balance: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTokensModal, setShowTokensModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          loadProfile(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Real-time token updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && 'token_balance' in payload.new) {
            setProfile(prev => prev ? { ...prev, token_balance: payload.new.token_balance } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, token_balance")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setProfile(data);
    }
    setLoading(false);
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

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <span className="font-semibold">{profile?.token_balance ?? 0}</span>
                  <span className="text-xs text-muted-foreground">tokens</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setShowTokensModal(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <UserProfileDropdown
                user={user}
                email={profile?.email ?? ""}
                tokenBalance={profile?.token_balance ?? 0}
                onSignOut={handleSignOut}
                onBuyTokens={() => setShowTokensModal(true)}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      <TokensModal open={showTokensModal} onOpenChange={setShowTokensModal} />
    </div>
  );
};

export default AppLayout;
