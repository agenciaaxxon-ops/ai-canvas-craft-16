import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Wand2, Zap, Sparkles, Camera, Image as ImageIcon } from "lucide-react";
import fotosmart from "@/assets/fotosmart-logo.svg";
import otoMascot from "@/assets/oto-mascot.png";
import otoHappy from "@/assets/oto-happy.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="glass-card border-b border-border/40">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={fotosmart} alt="FotoSmart" className="h-10 w-10 transition-transform group-hover:scale-110" />
            <span className="text-2xl font-bold gradient-text">FotoSmart</span>
          </Link>
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
      <section className="container mx-auto px-4 py-20 relative overflow-hidden">
        {/* Floating Orbs Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="floating-orb floating-orb-1" />
          <div className="floating-orb floating-orb-2" />
          <div className="floating-orb floating-orb-3" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side - Content */}
            <div className="space-y-8 text-center md:text-left animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-elevated text-sm">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-muted-foreground">Geração de imagens com IA</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                Transforme fotos de produtos em{" "}
                <span className="gradient-text">
                  obras de arte
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl">
                Escolha seu plano e transforme suas fotos em imagens profissionais de alta qualidade com a ajuda do Oto, seu assistente de IA.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                <Button size="lg" variant="hero" asChild className="text-lg px-8 glass-button-interactive">
                  <Link to="/sign-up">
                    <Wand2 className="mr-2 h-5 w-5" />
                    Começar Agora
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild className="text-lg px-8 glass-card-hover">
                  <Link to="/sign-in">Fazer Login</Link>
                </Button>
              </div>
            </div>

            {/* Right Side - Mascot */}
            <div className="flex justify-center animate-scale-in">
              <div className="relative">
                <img 
                  src={otoMascot} 
                  alt="Oto - Mascote FotoSmart" 
                  className="w-80 h-80 object-contain floating-animation drop-shadow-glow"
                />
                <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20 relative">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Por que escolher o <span className="gradient-text">FotoSmart</span>?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Potencialize suas imagens com tecnologia de ponta e simplicidade
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="glass-card-elevated glass-card-hover p-8 rounded-2xl group animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-glow">
              <Wand2 className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 gradient-text">IA Avançada</h3>
            <p className="text-muted-foreground leading-relaxed">
              Tecnologia de ponta para criar imagens impressionantes dos seus produtos com resultados profissionais
            </p>
          </div>

          <div className="glass-card-elevated glass-card-hover p-8 rounded-2xl group animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-glow">
              <Zap className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 gradient-text">Rápido e Simples</h3>
            <p className="text-muted-foreground leading-relaxed">
              Gere suas imagens em segundos. Interface intuitiva e fácil de usar, mesmo para iniciantes
            </p>
          </div>

          <div className="glass-card-elevated glass-card-hover p-8 rounded-2xl group animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-glow">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-2xl font-semibold mb-3 gradient-text">Qualidade Pro</h3>
            <p className="text-muted-foreground leading-relaxed">
              Resultados profissionais prontos para usar em suas campanhas e redes sociais
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="glass-card-elevated p-12 rounded-3xl max-w-4xl mx-auto text-center relative overflow-hidden">
          <div className="absolute top-10 right-10 opacity-50">
            <img src={otoHappy} alt="Oto feliz" className="w-32 h-32 object-contain floating-animation" />
          </div>
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Pronto para transformar suas <span className="gradient-text">imagens</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de usuários que já estão criando imagens incríveis com FotoSmart
            </p>
            <Button size="lg" variant="hero" asChild className="text-lg px-10 glass-button-interactive">
              <Link to="/sign-up">
                <Camera className="mr-2 h-5 w-5" />
                Começar Gratuitamente
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-card border-t border-border/40 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <img src={fotosmart} alt="FotoSmart" className="h-8 w-8" />
              <span className="text-lg font-semibold gradient-text">FotoSmart</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 FotoSmart. Transformando fotos em arte com IA.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;