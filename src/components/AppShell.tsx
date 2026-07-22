import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, ClipboardList, History, LayoutDashboard, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/" className="font-semibold text-lg bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
            Branch IT Checklist
          </Link>
          <nav className="flex items-center gap-1">
            {profile?.role === "employee" && (
              <>
                <Link to="/app/checklist"><Button variant="ghost" size="sm"><ClipboardList className="h-4 w-4 mr-1" />Checklist</Button></Link>
                <Link to="/app/history"><Button variant="ghost" size="sm"><History className="h-4 w-4 mr-1" />History</Button></Link>
              </>
            )}
            {(profile?.role === "admin" || profile?.role === "superadmin") && (
              <>
                <Link to="/admin/checklist"><Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</Button></Link>
                <Link to="/admin/employees"><Button variant="ghost" size="sm"><Users className="h-4 w-4 mr-1" />Employees</Button></Link>
              </>
            )}
            {profile?.role === "superadmin" && (
              <Link to="/super"><Button variant="ghost" size="sm"><Shield className="h-4 w-4 mr-1" />Super Admin</Button></Link>
            )}
            <span className="hidden sm:inline text-sm text-muted-foreground ml-2">{profile?.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
