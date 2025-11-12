import fotosmart from "@/assets/fotosmart-logo.svg";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="relative">
        <img 
          src={fotosmart} 
          alt="FotoSmart" 
          className="h-20 w-20 opacity-50 grayscale"
        />
        <AlertCircle className="absolute -bottom-1 -right-1 h-8 w-8 text-destructive bg-background rounded-full" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-xl font-semibold text-destructive">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar Novamente
        </Button>
      )}
    </div>
  );
};
