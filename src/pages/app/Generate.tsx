import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Wand2, Upload, Loader2 } from "lucide-react";

const Generate = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [product, setProduct] = useState("");
  const [model, setModel] = useState("");
  const [scene, setScene] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { toast } = useToast();

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
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const originalSignedUrl = `${baseUrl}${signed.signedUrl}`;

      // Call edge function to generate image
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt_product: product,
          prompt_model: model,
          prompt_scene: scene,
          original_image_url: originalSignedUrl,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        let specific = "";
        try {
          const anyErr: any = error as any;
          const res = anyErr?.context?.response;
          if (res && typeof res.json === "function") {
            const body = await res.json();
            specific = body?.error || body?.message || "";
          }
        } catch (e) {
          console.warn("Failed to parse function error body", e);
        }
        const msg = specific || error.message || "Erro desconhecido ao gerar imagem";
        setErrorMessage(msg);
        toast({ title: "Erro ao gerar imagem", description: msg, variant: "destructive" });
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

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Gerar Nova Imagem</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Column - Form */}
        <div className="space-y-6 bg-card p-6 rounded-xl border border-border/40">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="text-base">Imagem Original</Label>
              <div className="mt-2">
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input
                id="model"
                placeholder="Ex: Mulher"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scene">Cenário</Label>
              <Input
                id="scene"
                placeholder="Ex: Praia"
                value={scene}
                onChange={(e) => setScene(e.target.value)}
              />
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
        <div className="bg-card p-6 rounded-xl border border-border/40">
          <h3 className="text-xl font-semibold mb-4">Imagem Gerada</h3>
          {errorMessage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erro ao gerar imagem</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <div className="aspect-square rounded-xl bg-muted/50 flex items-center justify-center overflow-hidden">
            {loading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
    </div>
  );
};

export default Generate;