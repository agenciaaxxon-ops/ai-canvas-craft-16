import fotosmart from "@/assets/fotosmart-logo.svg";

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = ({ message = "Carregando..." }: LoadingStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        <img 
          src={fotosmart} 
          alt="FotoSmart" 
          className="h-16 w-16 animate-pulse"
        />
        <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-20 blur-xl animate-pulse" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};
