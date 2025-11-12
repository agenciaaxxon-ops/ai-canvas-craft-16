import fotosmart from "@/assets/fotosmart-logo.svg";
import { CheckCircle2 } from "lucide-react";

interface SuccessStateProps {
  title: string;
  description?: string;
}

export const SuccessState = ({ title, description }: SuccessStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="relative">
        <img 
          src={fotosmart} 
          alt="FotoSmart" 
          className="h-16 w-16"
        />
        <CheckCircle2 className="absolute -bottom-1 -right-1 h-6 w-6 text-primary bg-background rounded-full" />
        <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-20 blur-xl" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold gradient-text">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};
