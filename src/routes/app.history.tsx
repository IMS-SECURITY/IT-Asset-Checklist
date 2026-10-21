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
import { motion } from "framer-motion";

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
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <h1 className="page-title">My Submissions (Last 30 Days)</h1>
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
                <Item label="VCON" value={r.vcon} extra={r.vconProblem} />

                {r.printers && r.printers.length > 0 ? (
                  <div className="sm:col-span-3 p-2.5 border rounded-lg bg-muted/30 space-y-2 mt-1">
                    <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Printers & Toner Status ({r.printers.length})</span>
                      <Badge variant="outline">{r.printer || "Status"}</Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {r.printers.map((p: any, pIdx: number) => (
                        <div key={p.id || pIdx} className="p-2 border rounded bg-background text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold font-mono">{p.ip || `Printer #${pIdx + 1}`}</span>
                            <Badge className={p.status === "Working" ? "bg-success text-success-foreground" : p.status === "Not Working" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}>
                              {p.status}
                            </Badge>
                          </div>
                          {p.status === "Working" && (
                            <div className="text-[11px] text-muted-foreground">
                              {p.printerType === "Colour" ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-mono">K: {p.blackToner ?? 0}%</span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-mono">Y: {p.yellowToner ?? 0}%</span>
                                  <span className="px-1.5 py-0.5 rounded bg-pink-500 text-white font-mono">M: {p.magentaToner ?? 0}%</span>
                                  <span className="px-1.5 py-0.5 rounded bg-sky-500 text-white font-mono">C: {p.cyanToner ?? 0}%</span>
                                </div>
                              ) : (
                                <div className="mt-1 font-mono font-medium">Black Toner: {p.blackToner ?? 0}%</div>
                              )}
                            </div>
                          )}
                          {p.problem && <div className="text-destructive text-[11px] mt-0.5">Issue: {p.problem}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <Item label="Printer" value={r.printer} extra={r.printerProblem || r.printerIP} />
                    <Item label="Toner" value={r.tonerAvailable === "Yes" ? `Yes · ${r.tonerStatus}%` : "No"} />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
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
