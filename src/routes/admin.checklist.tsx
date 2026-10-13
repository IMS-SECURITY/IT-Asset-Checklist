import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Download, Wifi, Cable, Printer, Monitor, Droplet, AlertTriangle, CheckCircle2, XCircle, Eye, Clock } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/checklist")({
  component: () => (
    <RequireRole roles={["admin", "superadmin"]}>
      <AppShell><AdminDashboard /></AppShell>
    </RequireRole>
  ),
});

const COLORS = { Working: "var(--color-success)", "Not Working": "var(--color-destructive)", NA: "var(--color-muted-foreground)" };
const PIE_FILL = ["#22c55e", "#ef4444", "#9ca3af"];

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setValue(Math.round(from + (target - from) * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AdminDashboard() {
  const { profile } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const myProjects = useMemo(() => {
    if (profile?.role === "superadmin") return null;
    const list = new Set<string>();
    if (Array.isArray(profile?.adminProjects) && profile.adminProjects.length > 0) {
      profile.adminProjects.filter(Boolean).forEach((p) => list.add(p));
    }
    if (profile?.projectId) {
      list.add(profile.projectId);
    }
    return list.size > 0 ? Array.from(list) : null;
  }, [profile]);

  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load projects
      const projSnap = await getDocs(collection(db, "projects"));
      let projs = projSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (myProjects && myProjects.length > 0) {
        projs = projs.filter((p) => myProjects.includes(p.id));
      }
      setProjects(projs);

      const projIdsInScope = projectFilter === "all" ? projs.map((p) => p.id) : [projectFilter];

      // 2. Load employees in scope
      const empSnap = await getDocs(collection(db, "employees"));
      const emps = empSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((e) => e.role === "employee" && (projIdsInScope.length === 0 || projIdsInScope.includes(e.projectId)));
      setEmployees(emps);

      // 3. Load submissions in date range, scoped to projects
      const subsAll: any[] = [];
      try {
        const subSnap = await getDocs(collection(db, "checklists"));
        subSnap.forEach((d) => {
          const data: any = d.data();
          const inScope =
            projIdsInScope.length === 0 ||
            projIdsInScope.includes(data.projectId) ||
            (data.projectName && projs.some((p) => p.name === data.projectName || p.id === data.projectId));

          const inDate =
            (!fromDate || data.date >= fromDate) &&
            (!toDate || data.date <= toDate);

          if (inScope && inDate) {
            subsAll.push({ id: d.id, ...data });
          }
        });
      } catch (colErr: any) {
        // Fallback for query if collection-wide read is denied
        if (projIdsInScope.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < projIdsInScope.length; i += 30) {
            chunks.push(projIdsInScope.slice(i, i + 30));
          }
          for (const chunk of chunks) {
            try {
              const qs = query(
                collection(db, "checklists"),
                where("projectId", "in", chunk)
              );
              const chunkSnap = await getDocs(qs);
              chunkSnap.forEach((d) => {
                const data: any = d.data();
                if ((!fromDate || data.date >= fromDate) && (!toDate || data.date <= toDate)) {
                  subsAll.push({ id: d.id, ...data });
                }
              });
            } catch (chunkErr) {
              console.warn("Chunk query error:", chunkErr);
            }
          }
        }
        if (subsAll.length === 0 && colErr?.message) {
          toast.error(colErr?.message || "Failed to load dashboard submissions");
        }
      }

      setSubmissions(subsAll);
      setLastRefreshed(format(new Date(), "HH:mm:ss"));
    } catch (err: any) {
      toast.error(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [projectFilter, fromDate, toDate, myProjects]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh at 11:00 daily
  useEffect(() => {
    const check = () => {
      const now = new Date();
      if (now.getHours() === 11 && now.getMinutes() === 0 && now.getSeconds() < 30) load();
    };
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [load]);

  const todaySubs = submissions.filter((s) => s.date === today);
  const submittedTodayUids = new Set(todaySubs.map((s) => s.uid));
  const notSubmittedToday = employees.filter((e) => !submittedTodayUids.has(e.id));

  const counts = useMemo(() => {
    const c = {
      submittedToday: todaySubs.length,
      notSubmittedToday: notSubmittedToday.length,
      wifiDown: submissions.filter((s) => s.wifi === "Not Working").length,
      lanDown: submissions.filter((s) => s.lan === "Not Working").length,
      printerDown: submissions.filter((s) => s.printer === "Not Working").length,
      lowToner: submissions.filter((s) => s.tonerAvailable === "Yes" && (s.tonerStatus ?? 100) < 20).length,
      vconDown: submissions.filter((s) => s.vcon === "Not Working").length,
    };
    return c;
  }, [submissions, todaySubs.length, notSubmittedToday.length]);

  const statusData = (key: string) => {
    const tally: Record<string, number> = { Working: 0, "Not Working": 0, NA: 0 };
    submissions.forEach((s) => { if (s[key] in tally) tally[s[key]]++; });
    return Object.entries(tally).map(([name, value]) => ({ name, value }));
  };

  const tonerData = () => {
    const yes = submissions.filter((s) => s.tonerAvailable === "Yes").length;
    const no = submissions.filter((s) => s.tonerAvailable === "No").length;
    return [{ name: "Yes", value: yes }, { name: "No", value: no }];
  };

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const summary = [
      ["Metric", "Value"],
      ["Submitted Today", counts.submittedToday],
      ["Not Submitted Today", counts.notSubmittedToday],
      ["WiFi Not Working", counts.wifiDown],
      ["LAN Not Working", counts.lanDown],
      ["Printer Not Working", counts.printerDown],
      ["Low Toner (<20%)", counts.lowToner],
      ["VCON Issues", counts.vconDown],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

    const subsRows = submissions.map((s) => ({
      Project: s.projectName,
      EmployeeID: s.employeeID,
      Employee: s.employeeName,
      Branch: s.branch,
      Date: s.date,
      WiFi: s.wifi,
      "WiFi Problem": s.wifiProblem,
      LAN: s.lan,
      "LAN Problem": s.lanProblem,
      Printer: s.printer,
      "Printer IP": s.printerIP,
      "Printer Problem": s.printerProblem,
      "Toner Available": s.tonerAvailable,
      "Toner %": s.tonerStatus,
      VCON: s.vcon,
      "VCON Problem": s.vconProblem,
      "Submitted At": s.submittedAt?.toDate ? format(s.submittedAt.toDate(), "yyyy-MM-dd HH:mm:ss") : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subsRows), "Submissions");

    const missing = notSubmittedToday.map((e) => ({
      Project: e.projectName,
      EmployeeID: e.employeeID,
      Name: e.name,
      Location: e.location,
      Branches: (e.branches || []).join(", "),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missing), "Missing");

    XLSX.writeFile(wb, `checklist_report_${today}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3 items-end justify-between">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="section-label text-sm">{profile?.role === "superadmin" ? "All projects" : `${projects.length} project(s)`}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Project</div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">From</div>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">To</div>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={fromDate === today && toDate === today ? "default" : "outline"}
              onClick={() => { setFromDate(today); setToDate(today); }}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={fromDate === format(subDays(new Date(), 7), "yyyy-MM-dd") ? "default" : "outline"}
              onClick={() => { setFromDate(format(subDays(new Date(), 7), "yyyy-MM-dd")); setToDate(today); }}
            >
              7 Days
            </Button>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} title={lastRefreshed ? `Last updated: ${lastRefreshed}` : undefined}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportXlsx}><Download className="h-4 w-4 mr-1" />Export</Button>
        </div>
      </motion.div>

      {lastRefreshed && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground -mt-3">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>Last synchronized: <strong>{lastRefreshed}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Submitted Today" value={counts.submittedToday} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <Kpi label="Not Submitted" value={counts.notSubmittedToday} icon={<XCircle className="h-4 w-4" />} tone="danger" />
        <Kpi label="WiFi Down" value={counts.wifiDown} icon={<Wifi className="h-4 w-4" />} tone="danger" />
        <Kpi label="LAN Down" value={counts.lanDown} icon={<Cable className="h-4 w-4" />} tone="danger" />
        <Kpi label="Printer Down" value={counts.printerDown} icon={<Printer className="h-4 w-4" />} tone="danger" />
        <Kpi label="Low Toner" value={counts.lowToner} icon={<Droplet className="h-4 w-4" />} tone="warning" />
        <Kpi label="VCON Issues" value={counts.vconDown} icon={<Monitor className="h-4 w-4" />} tone="danger" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PieCard title="WiFi Status" data={statusData("wifi")} />
        <PieCard title="LAN Status" data={statusData("lan")} />
        <PieCard title="Printer Status" data={statusData("printer")} />
        <PieCard title="VCON Status" data={statusData("vcon")} />
        <Card>
          <CardHeader><CardTitle className="text-base">Toner Availability</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tonerData()}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Not Submitted Today</CardTitle></CardHeader>
        <CardContent>
          {notSubmittedToday.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Everyone has submitted today 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Employee ID</TableHead><TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Branches</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {notSubmittedToday.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell>{e.employeeID}</TableCell>
                      <TableCell>{e.projectName}</TableCell>
                      <TableCell>{e.location}</TableCell>
                      <TableCell>{(e.branches && e.branches.length > 0) ? e.branches.join(", ") : <span className="text-muted-foreground italic text-xs">None assigned</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Submissions ({submissions.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>ID</TableHead><TableHead>Project</TableHead><TableHead>Branch</TableHead>
                <TableHead>WiFi</TableHead><TableHead>LAN</TableHead><TableHead>Printer</TableHead><TableHead>Toner</TableHead><TableHead>VCON</TableHead><TableHead>Time</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-6">No submissions found for the selected filter and dates</TableCell></TableRow>
                ) : (
                  submissions.sort((a, b) => (a.date < b.date ? 1 : -1)).map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelectedSubmission(s)}>
                      <TableCell className="font-medium">{s.date}</TableCell>
                      <TableCell>{s.employeeName}</TableCell>
                      <TableCell className="text-xs">{s.employeeID}</TableCell>
                      <TableCell>{s.projectName}</TableCell>
                      <TableCell>{s.branch}</TableCell>
                      <TableCell><StatusBadge v={s.wifi} hasProblem={Boolean(s.wifiProblem)} /></TableCell>
                      <TableCell><StatusBadge v={s.lan} hasProblem={Boolean(s.lanProblem)} /></TableCell>
                      <TableCell><StatusBadge v={s.printer} hasProblem={Boolean(s.printerProblem)} /></TableCell>
                      <TableCell>{s.tonerAvailable === "Yes" ? `${s.tonerStatus}%` : "No"}</TableCell>
                      <TableCell><StatusBadge v={s.vcon} hasProblem={Boolean(s.vconProblem)} /></TableCell>
                      <TableCell className="text-xs">{s.submittedAt?.toDate ? format(s.submittedAt.toDate(), "HH:mm") : ""}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubmission(s);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Submission Detail Modal */}
      <Dialog open={Boolean(selectedSubmission)} onOpenChange={(open) => !open && setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Checklist Details — {selectedSubmission?.employeeName}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4 text-sm mt-2">
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg">
                <div><span className="text-xs text-muted-foreground block">Date</span><strong>{selectedSubmission.date}</strong></div>
                <div><span className="text-xs text-muted-foreground block">Branch</span><strong>{selectedSubmission.branch}</strong></div>
                <div><span className="text-xs text-muted-foreground block">Project</span><strong>{selectedSubmission.projectName}</strong></div>
                <div><span className="text-xs text-muted-foreground block">Employee ID</span><strong>{selectedSubmission.employeeID}</strong></div>
              </div>

              <div className="space-y-3">
                <div className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2"><Wifi className="h-4 w-4" />WiFi</span>
                    <StatusBadge v={selectedSubmission.wifi} />
                  </div>
                  {selectedSubmission.wifiProblem && (
                    <div className="text-xs text-destructive mt-1 bg-destructive/10 p-2 rounded">
                      <strong>Issue:</strong> {selectedSubmission.wifiProblem}
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2"><Cable className="h-4 w-4" />LAN</span>
                    <StatusBadge v={selectedSubmission.lan} />
                  </div>
                  {selectedSubmission.lanProblem && (
                    <div className="text-xs text-destructive mt-1 bg-destructive/10 p-2 rounded">
                      <strong>Issue:</strong> {selectedSubmission.lanProblem}
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2"><Printer className="h-4 w-4" />Printer</span>
                    <StatusBadge v={selectedSubmission.printer} />
                  </div>
                  {selectedSubmission.printerIP && (
                    <div className="text-xs text-muted-foreground">IP Address: <span className="font-mono">{selectedSubmission.printerIP}</span></div>
                  )}
                  {selectedSubmission.printerProblem && (
                    <div className="text-xs text-destructive mt-1 bg-destructive/10 p-2 rounded">
                      <strong>Issue:</strong> {selectedSubmission.printerProblem}
                    </div>
                  )}
                </div>

                <div className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2"><Droplet className="h-4 w-4" />Toner</span>
                    <Badge variant="outline">{selectedSubmission.tonerAvailable === "Yes" ? `Available (${selectedSubmission.tonerStatus}%)` : "Not Available"}</Badge>
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2"><Monitor className="h-4 w-4" />VCON / Laptop Room</span>
                    <StatusBadge v={selectedSubmission.vcon} />
                  </div>
                  {selectedSubmission.vconProblem && (
                    <div className="text-xs text-destructive mt-1 bg-destructive/10 p-2 rounded">
                      <strong>Issue:</strong> {selectedSubmission.vconProblem}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ v, hasProblem }: { v: string; hasProblem?: boolean }) {
  const cls =
    v === "Working" ? "bg-success text-success-foreground" :
    v === "Not Working" ? "bg-destructive text-destructive-foreground" :
    "bg-muted text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge className={cls}>{v}</Badge>
      {hasProblem && <AlertTriangle className="h-3 w-3 text-destructive inline" title="Issue reported" />}
    </span>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "success" | "danger" | "warning" | "info" }) {
  const v = useCountUp(value);
  const bg =
    tone === "success" ? "var(--gradient-success)" :
    tone === "danger" ? "var(--gradient-danger)" :
    tone === "warning" ? "var(--gradient-warning)" :
    "var(--gradient-primary)";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden border-0 text-white" style={{ background: bg }}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs opacity-90">{label}</div>
              <div className="text-3xl font-bold mt-1">{v}</div>
            </div>
            <div className="opacity-80">{icon}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PieCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const empty = data.every((d) => d.value === 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-56">
        {empty ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                {data.map((_, i) => <Cell key={i} fill={PIE_FILL[i]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
