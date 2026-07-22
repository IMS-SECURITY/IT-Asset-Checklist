import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/history")({
  component: () => (
    <RequireRole roles={["employee"]}>
      <AppShell><History /></AppShell>
    </RequireRole>
  ),
});

function History() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
        const q = query(collection(db, "checklists"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((r: any) => r.date >= since)
          .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
        setRows(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Submissions (Last 30 Days)</h1>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No submissions in the last 30 days.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
                  <span>{r.date} · {r.branch}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {r.submittedAt?.toDate ? format(r.submittedAt.toDate(), "HH:mm:ss") : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-3 gap-2 text-sm">
                <Item label="WiFi" value={r.wifi} extra={r.wifiProblem} />
                <Item label="LAN" value={r.lan} extra={r.lanProblem} />
                <Item label="Printer" value={r.printer} extra={r.printerProblem || r.printerIP} />
                <Item label="Toner" value={r.tonerAvailable === "Yes" ? `Yes · ${r.tonerStatus}%` : "No"} />
                <Item label="VCON" value={r.vcon} extra={r.vconProblem} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Item({ label, value, extra }: { label: string; value: string; extra?: string }) {
  const color =
    value === "Working" || value?.startsWith("Yes") ? "bg-success text-success-foreground" :
    value === "Not Working" || value === "No" ? "bg-destructive text-destructive-foreground" :
    "bg-muted text-muted-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Badge className={color}>{value}</Badge>
      {extra && <div className="text-xs text-muted-foreground mt-1 truncate">{extra}</div>}
    </div>
  );
}
