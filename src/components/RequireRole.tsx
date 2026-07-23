import { Navigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/lib/auth-context";
import type { ReactNode } from "react";
import type { Role } from "@/lib/types";

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return <LoadingScreen label="Verifying access…" />;
  }
  if (!user || !profile) return <Navigate to="/login" />;
  if (!roles.includes(profile.role)) return <Navigate to="/" />;
  return <>{children}</>;
}
