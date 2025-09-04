import type { ShirtData, TexturePlacement } from "@/types";
import { useEcho } from "@merit-systems/echo-react-sdk";
import { useEffect, useState, type ReactNode } from "react";
import { ShirtDataContext } from "./ShirtDataContextBase";

export function ShirtDataProvider({ children }: { children: ReactNode }) {
  const [shirtData, setShirtData] = useState<ShirtData | null>(null);
  const [texturePlacement, setTexturePlacement] =
    useState<TexturePlacement>("front");
  const [isLoading, setIsLoading] = useState(false);
  const [shirtColor, setShirtColor] = useState("#f8f9fa"); // Lightest shirt color (White)
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] =
    useState(false);

  // Centralize authentication state to prevent multiple useEcho calls
  const {
    isLoading: isAuthLoading,
    signIn,
    user,
    // balance,
  } = useEcho();

  // Prevent navigation/refresh during loading
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isLoading) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue =
          "Your design is still generating. Are you sure you want to leave?";
        return "Your design is still generating. Are you sure you want to leave?";
      }
    };

    if (isLoading) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isLoading]);

  return (
    <ShirtDataContext.Provider
      value={{
        shirtData,
        setShirtData,
        texturePlacement,
        setTexturePlacement,
        isLoading,
        setIsLoading,
        isAuthLoading,
        shirtColor,
        setShirtColor,
        signIn,
        showInsufficientBalanceModal,
        setShowInsufficientBalanceModal,
        user,
      }}
    >
      {children}
    </ShirtDataContext.Provider>
  );
}

// Hook moved to ./useShirtData to satisfy react-refresh rule
