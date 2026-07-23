import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, ClipboardList, History, LayoutDashboard, Shield, Users } from "lucide-react";
import tvseLogo from "@/assets/tvse-logo.svg";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 shadow-soft backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={tvseLogo} alt="TVSE Electronics" className="h-10 w-auto" />
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.35em] text-muted-foreground">TVS Electronics</span>
              <span className="text-base font-semibold tracking-wide text-primary md:text-xl">Branch IT Checklist</span>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
              {profile?.role ?? "Guest"}
            </span>
            {profile?.role === "employee" && (
              <>
                <Link to="/app/checklist"><Button variant="ghost" size="sm"><ClipboardList className="mr-1 h-4 w-4" />Checklist</Button></Link>
                <Link to="/app/history"><Button variant="ghost" size="sm"><History className="mr-1 h-4 w-4" />History</Button></Link>
              </>
            )}
            {(profile?.role === "admin" || profile?.role === "superadmin") && (
              <>
                <Link to="/admin/checklist"><Button variant="ghost" size="sm"><LayoutDashboard className="mr-1 h-4 w-4" />Dashboard</Button></Link>
                <Link to="/admin/employees"><Button variant="ghost" size="sm"><Users className="mr-1 h-4 w-4" />Employees</Button></Link>
              </>
            )}
            {profile?.role === "superadmin" && (
              <Link to="/super"><Button variant="ghost" size="sm"><Shield className="mr-1 h-4 w-4" />Super Admin</Button></Link>
            )}
            <ThemeToggle />
            <span className="ml-2 hidden text-sm text-muted-foreground sm:inline">{profile?.name ?? "User"}</span>
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
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
