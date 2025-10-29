import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, CreditCard, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserProfileDropdownProps {
  user: User;
  email: string;
  tokenBalance: number;
  onSignOut: () => void;
  onBuyTokens: () => void;
}

export function UserProfileDropdown({
  user,
  email,
  tokenBalance,
  onSignOut,
  onBuyTokens,
}: UserProfileDropdownProps) {
  const navigate = useNavigate();

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Avatar className="h-8 w-8 cursor-pointer">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(email)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {tokenBalance} {tokenBalance === 1 ? "token" : "tokens"} disponíveis
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onBuyTokens} className="cursor-pointer">
          <Coins className="mr-2 h-4 w-4" />
          Comprar Tokens
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/app/plan")} className="cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4" />
          Meu Plano
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
