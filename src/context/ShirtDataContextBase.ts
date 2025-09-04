import type { ShirtData, TexturePlacement } from "@/types";
import type { EchoUser } from "@merit-systems/echo-react-sdk";
import { createContext } from "react";

export interface ShirtDataContextType {
  shirtData: ShirtData | null;
  setShirtData: (data: ShirtData | null) => void;
  texturePlacement: TexturePlacement;
  setTexturePlacement: (placement: TexturePlacement) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  isAuthLoading: boolean;
  shirtColor: string;
  setShirtColor: (color: string) => void;
  signIn: () => void;
  showInsufficientBalanceModal: boolean;
  setShowInsufficientBalanceModal: (show: boolean) => void;
  user: EchoUser | null;
}

export const ShirtDataContext = createContext<ShirtDataContextType | undefined>(
  undefined,
);
