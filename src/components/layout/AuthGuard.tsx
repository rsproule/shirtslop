import { Navbar } from "@/components/layout/Navbar";
import { useShirtData } from "@/context/useShirtData";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthLoading, user } = useShirtData();

  // Show loading during initial authentication
  if (isAuthLoading && !user) {
    return (
      <div className="flex min-h-svh flex-col bg-white">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
