import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";
import type { Role } from "@/lib/types";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/login" />;
  if (!roles.includes(profile.role)) return <Navigate to="/" />;
  return <>{children}</>;
}
