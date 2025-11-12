import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Wand2, Zap, Sparkles, ArrowRight } from "lucide-react";
import fotosmart from "@/assets/fotosmart-logo.svg";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card-elevated border-b border-border/20">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="group">
            <img 
              src={fotosmart} 
              alt="FotoSmart" 
              className="h-8 w-8 transition-all duration-300 group-hover:scale-110 group-hover:drop-shadow-glow" 
            />
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild className="text-sm font-medium">
              <Link to="/sign-in">Entrar</Link>
            </Button>
            <Button variant="default" asChild className="text-sm font-medium bg-primary hover:bg-primary/90">
              <Link to="/sign-up">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative overflow-hidden pt-20">
        {/* Floating Orbs Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="floating-orb floating-orb-1" />
          <div className="floating-orb floating-orb-2" />
          <div className="floating-orb floating-orb-3" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo icon large */}
            <div className="flex justify-center mb-8 animate-scale-in">
              <div className="relative">
                <img 
                  src={fotosmart} 
                  alt="FotoSmart" 
                  className="h-20 w-20 drop-shadow-glow"
                />
                <div className="absolute inset-0 bg-gradient-primary opacity-30 blur-2xl rounded-full" />
              </div>
            </div>

            <div className="space-y-6 animate-fade-in">
              <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-none">
                Transforme suas
                <br />
                <span className="gradient-text">imagens</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
                Crie fotos profissionais com inteligência artificial.
                <br />
                Simples. Rápido. Impressionante.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Button 
                size="lg" 
                asChild 
                className="text-base font-medium px-8 h-12 bg-primary hover:bg-primary/90 shadow-glow"
              >
                <Link to="/sign-up">
                  Começar gratuitamente
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-16 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="space-y-1">
                <div className="text-3xl md:text-4xl font-bold gradient-text">10k+</div>
                <div className="text-sm text-muted-foreground">Imagens geradas</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl md:text-4xl font-bold gradient-text">5k+</div>
                <div className="text-sm text-muted-foreground">Usuários ativos</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl md:text-4xl font-bold gradient-text">4.9/5</div>
                <div className="text-sm text-muted-foreground">Avaliação</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
                Simples. <span className="gradient-text">Poderoso.</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light">
                Tudo que você precisa para criar imagens profissionais
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="glass-card-elevated p-10 rounded-3xl group hover:scale-[1.02] transition-all duration-500">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <Wand2 className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">IA Avançada</h3>
                <p className="text-muted-foreground leading-relaxed font-light">
                  Modelos de última geração que transformam suas fotos em obras de arte
                </p>
              </div>

              <div className="glass-card-elevated p-10 rounded-3xl group hover:scale-[1.02] transition-all duration-500">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Ultra Rápido</h3>
                <p className="text-muted-foreground leading-relaxed font-light">
                  Resultados em segundos. Sem espera, sem complicação
                </p>
              </div>

              <div className="glass-card-elevated p-10 rounded-3xl group hover:scale-[1.02] transition-all duration-500">
                <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-semibold mb-4">Qualidade Pro</h3>
                <p className="text-muted-foreground leading-relaxed font-light">
                  Imagens prontas para suas campanhas e redes sociais
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <div className="glass-card-elevated p-16 md:p-24 rounded-[2rem] max-w-5xl mx-auto text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-primary opacity-5" />
            <div className="relative z-10 space-y-8">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tight">
                Comece <span className="gradient-text">agora</span>
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
                Experimente gratuitamente. Sem cartão de crédito.
              </p>
              <div className="pt-4">
                <Button 
                  size="lg" 
                  asChild 
                  className="text-base font-medium px-10 h-14 bg-primary hover:bg-primary/90 shadow-glow"
                >
                  <Link to="/sign-up">
                    Criar conta gratuita
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-card-elevated border-t border-border/20">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col items-center gap-6">
            <img src={fotosmart} alt="FotoSmart" className="h-8 w-8 opacity-60" />
            <p className="text-sm text-muted-foreground font-light">
              © 2025 FotoSmart. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;