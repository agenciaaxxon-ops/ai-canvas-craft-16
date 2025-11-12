import fotosmart from "@/assets/fotosmart-logo.svg";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ title, description, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="relative">
        <img 
          src={fotosmart} 
          alt="FotoSmart" 
          className="h-24 w-24 opacity-50"
        />
        <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-10 blur-2xl" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button variant="hero" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
