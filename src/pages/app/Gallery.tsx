import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Wand2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Generation {
  id: string;
  created_at: string;
  prompt_product: string;
  prompt_model: string;
  prompt_scene: string;
  generated_image_url: string;
}

const Gallery = () => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setGenerations(data);
    }
    setLoading(false);
  };

  const handleDownload = async (imageUrl: string, productName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${productName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Download iniciado",
        description: "Sua imagem está sendo baixada",
      });
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Erro ao baixar",
        description: "Não foi possível baixar a imagem",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Minha Galeria</h1>

      {generations.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border/40">
          <p className="text-muted-foreground mb-6 text-lg">
            Você ainda não gerou nenhuma imagem.
          </p>
          <Button variant="hero" asChild>
            <Link to="/app/generate">
              <Wand2 className="mr-2 h-5 w-5" />
              Gerar Primeira Imagem
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generations.map((gen) => (
            <Dialog key={gen.id}>
              <DialogTrigger asChild>
                <div className="group cursor-pointer bg-card rounded-xl border border-border/40 overflow-hidden hover:border-primary/40 transition-all">
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img
                      src={gen.generated_image_url}
                      alt={`${gen.prompt_product} - ${gen.prompt_scene}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-medium truncate">{gen.prompt_product}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {gen.prompt_model} • {gen.prompt_scene}
                    </p>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <img
                  src={gen.generated_image_url}
                  alt={`${gen.prompt_product} - ${gen.prompt_scene}`}
                  className="w-full rounded-lg"
                />
                <div className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <p><strong>Produto:</strong> {gen.prompt_product}</p>
                    <p><strong>Modelo:</strong> {gen.prompt_model}</p>
                    <p><strong>Cenário:</strong> {gen.prompt_scene}</p>
                  </div>
                  <Button 
                    onClick={() => handleDownload(gen.generated_image_url, gen.prompt_product)}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Imagem
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;