import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || !profile) return <Navigate to="/login" />;
  if (profile.role === "superadmin") return <Navigate to="/super" />;
  if (profile.role === "admin") return <Navigate to="/admin/checklist" />;
  return <Navigate to="/app/checklist" />;
}
