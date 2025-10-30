import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Wand2, Sparkles, Zap } from "lucide-react";
import { useEffect } from "react";
const Landing = () => {
  useEffect(() => {
    try {
      const key = 'fb_pageview_landing';
      if (!sessionStorage.getItem(key) && typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'PageView');
        sessionStorage.setItem(key, '1');
        console.log('Meta Pixel: PageView tracked on Landing');
      }
    } catch {}
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Estúdio AI</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link to="/sign-in">Login</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/sign-up">Começar Agora</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Geração de imagens com IA</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            Transforme fotos de produtos em{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              obras de arte
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Comece grátis agora. Transforme suas fotos em imagens profissionais sem compromisso.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" variant="hero" asChild className="text-lg px-8">
              <Link to="/sign-up">
                <Wand2 className="mr-2 h-5 w-5" />
                Começar Agora
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="text-lg px-8">
              <Link to="/sign-in">Fazer Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-6 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">IA Avançada</h3>
            <p className="text-muted-foreground">
              Tecnologia de ponta para criar imagens impressionantes dos seus produtos
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all">
            <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Rápido e Simples</h3>
            <p className="text-muted-foreground">
              Gere suas imagens em segundos. Interface intuitiva e fácil de usar
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Qualidade Pro</h3>
            <p className="text-muted-foreground">
              Resultados profissionais prontos para usar em suas campanhas
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;