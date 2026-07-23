import { createFileRoute, Navigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return <LoadingScreen label="Starting session…" />;
  }
  if (!user || !profile) return <Navigate to="/login" />;
  if (profile.role === "superadmin") return <Navigate to="/super" />;
  if (profile.role === "admin") return <Navigate to="/admin/checklist" />;
  return <Navigate to="/app/checklist" />;
}
