import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    setShowBanner(false);
    
    // Initialize Facebook Pixel after consent
    if (window.fbq) {
      window.fbq('consent', 'grant');
    }
  };

  const handleReject = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    setShowBanner(false);
    
    // Revoke Facebook Pixel consent
    if (window.fbq) {
      window.fbq('consent', 'revoke');
    }
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom">
      <Card className="max-w-4xl mx-auto border-2 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-lg">🍪 Usamos Cookies</h3>
              <p className="text-sm text-muted-foreground">
                Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência, 
                analisar o uso do site e auxiliar em nossas campanhas de marketing. 
                Ao continuar navegando, você concorda com nossa Política de Privacidade.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleReject}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleAccept} className="flex-1">
              Aceitar Todos
            </Button>
            <Button onClick={handleReject} variant="outline" className="flex-1">
              Rejeitar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
