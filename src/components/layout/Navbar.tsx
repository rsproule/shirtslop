import { Branding } from "@/components/ui/branding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useShirtData } from "@/context/useShirtData";
import { SHOPIFY_URL } from "@/lib/utils";
import { EchoSignIn, EchoTokenPurchase } from "@merit-systems/echo-react-sdk";
import { Store } from "lucide-react";

export function Navbar() {
  const { user, isAuthLoading } = useShirtData();

  return (
    <nav className="border-border border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <Branding size="small" />

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(SHOPIFY_URL, "_blank")}
            className="px-2 py-1"
          >
            <Store className="h-4 w-4" />
          </Button>

          {isAuthLoading && !user ? (
            <Skeleton className="h-8 w-24" />
          ) : user !== null ? (
            <EchoTokenPurchase />
          ) : (
            <EchoSignIn />
          )}
        </div>
      </div>
    </nav>
  );
}
