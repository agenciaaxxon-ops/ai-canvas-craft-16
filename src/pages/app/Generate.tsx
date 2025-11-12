import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wand2, Upload, Loader2, Download } from "lucide-react";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { useSearchParams } from "react-router-dom";

const Generate = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [product, setProduct] = useState("");
  const [model, setModel] = useState("");
  const [scene, setScene] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast({
        title: "Compra realizada com sucesso!",
        description: "Seus créditos foram adicionados à sua conta.",
      });
      setSearchParams({});
    } else if (canceled === "true") {
      toast({
        title: "Compra cancelada",
        description: "Você pode tentar novamente quando quiser.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleGenerate = async () => {
    if (!file || !product || !model || !scene) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e envie uma imagem",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGeneratedUrl("");
    setErrorMessage("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Upload original image
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("original-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from("original-images")
        .createSignedUrl(fileName, 60 * 30);
      if (signedError || !signed?.signedUrl) throw signedError || new Error("Falha ao gerar URL assinada da imagem");
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const sUrl = signed.signedUrl;
      const originalSignedUrl = sUrl.startsWith("http") ? sUrl : `${baseUrl}${sUrl}`;

      // Call edge function (backend now handles ALL subscription validation)
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt_product: product,
          prompt_model: model,
          prompt_scene: scene,
          prompt_observations: observations,
          original_image_url: originalSignedUrl,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        
        // Parse error to get details
        const anyErr: any = error as any;
        let errorMsg = error.message || "Erro ao gerar imagem";
        let isSubscriptionError = false;
        
        // Try to extract error from FunctionsHttpError or FunctionsFetchError
        try {
          if (anyErr?.context?.body) {
            const body = anyErr.context.body;
            if (body?.error) {
              errorMsg = body.error;
            }
          }
        } catch (e) {
          console.warn("Failed to parse error body", e);
        }
        
        // Check if it's subscription related or AI credits exhaustion
        if (errorMsg.includes("Assinatura") || 
            errorMsg.includes("Limite") ||
            errorMsg.includes("inativa") ||
            errorMsg.includes("plano")) {
          isSubscriptionError = true;
        }

        const isAICreditsError = /Not enough credits|payment_required|AI gateway/i.test(errorMsg) 
          || anyErr?.context?.body?.type === 'payment_required';
        
        if (isSubscriptionError) {
          setShowSubscriptionModal(true);
          setErrorMessage(errorMsg);
          toast({ 
            title: "Assinatura necessária", 
            description: errorMsg, 
            variant: "destructive" 
          });
        } else if (isAICreditsError) {
          const friendly = "Serviço de geração temporariamente indisponível (créditos do provedor esgotados). Tente novamente em alguns minutos.";
          setShowSubscriptionModal(false);
          setErrorMessage(friendly);
          toast({
            title: "Serviço indisponível",
            description: friendly,
            variant: "destructive",
          });
        } else {
          setErrorMessage(errorMsg);
          toast({ 
            title: "Erro ao gerar imagem", 
            description: errorMsg, 
            variant: "destructive" 
          });
        }
        
        setLoading(false);
        return;
      }

      if (!data?.generated_image_url) {
        const msg = "Resposta inválida do servidor";
        setErrorMessage(msg);
        toast({ title: "Erro ao gerar imagem", description: msg, variant: "destructive" });
        return;
      }

      setGeneratedUrl(data.generated_image_url);
      toast({
        title: "Imagem gerada com sucesso!",
        description: "Sua imagem foi criada e salva na galeria",
      });

    } catch (error: any) {
      console.error("Error generating image:", error);
      toast({
        title: "Erro ao gerar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedUrl) return;
    
    try {
      const response = await fetch(generatedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagem-gerada-${Date.now()}.png`;
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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 gradient-text">Gerar Nova Imagem</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Form */}
        <div className="space-y-6 glass-card p-6 rounded-xl">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="text-base">Imagem Original</Label>
              <div className="mt-2">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed glass-card rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-glow-primary transition-all"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-full w-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6">
                      <Upload className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Clique para fazer upload</p>
                    </div>
                  )}
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Produto</Label>
              <Input
                id="product"
                placeholder="Ex: Tornozeleira"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="glass-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                placeholder="Ex: Mulher"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="glass-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scene">Cenário</Label>
              <Input
                id="scene"
                placeholder="Ex: Praia"
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                className="glass-card"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observations">Observações (Opcional)</Label>
              <Textarea
                id="observations"
                placeholder="Ex: foco no produto, foto de celular, fundo desfocado"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                maxLength={100}
                className="resize-none glass-card"
              />
              <p className="text-xs text-muted-foreground text-right">
                {observations.length}/100
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              variant="hero"
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Gerar Imagem
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Column - Result */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Imagem Gerada</h3>
            {generatedUrl && !loading && (
              <Button onClick={handleDownload} variant="glass" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            )}
          </div>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4 glass-card">
              <AlertTitle>Erro ao gerar imagem</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="aspect-square rounded-xl glass-card flex items-center justify-center overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando sua imagem...</p>
              </div>
            ) : generatedUrl ? (
              <img
                src={generatedUrl}
                alt="Generated"
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground text-center px-6">
                A imagem gerada aparecerá aqui
              </p>
            )}
          </div>
        </div>
      </div>

      <SubscriptionModal open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal} />
    </div>
  );
};

export default Generate;
