import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, UserPlus, UserMinus, Download, ShieldPlus, Mail, MailX } from "lucide-react";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { createAppUser } from "@/lib/user-admin";
import { CreateEmployeeDialog } from "./admin.employees";
import { EmailRecipientsSection } from "@/components/EmailRecipientsSection";
import { SendNowSection } from "@/components/SendNowSection";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export const Route = createFileRoute("/super")({
  component: () => (
    <RequireRole roles={["superadmin"]}>
      <AppShell><SuperPanel /></AppShell>
    </RequireRole>
  ),
});

function SuperPanel() {
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const load = useCallback(async () => {
    const [ps, es, ss] = await Promise.all([
      getDocs(collection(db, "projects")),
      getDocs(collection(db, "employees")),
      getDocs(collection(db, "checklists")),
    ]);
    setProjects(ps.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setEmployees(es.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setSubmissions(ss.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportAll = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects.map((p) => ({ ID: p.id, Name: p.name }))), "Projects");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map((e) => ({
      UID: e.id, EmployeeID: e.employeeID, Name: e.name, Email: e.email, Role: e.role,
      Project: e.projectName, Location: e.location, Branches: (e.branches || []).join(", "),
      AdminProjects: (e.adminProjects || []).join(", "),
    }))), "Employees");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(submissions.map((s) => ({
      Date: s.date, Project: s.projectName, Branch: s.branch, EmployeeID: s.employeeID, Employee: s.employeeName,
      WiFi: s.wifi, LAN: s.lan, Printer: s.printer, Toner: s.tonerAvailable === "Yes" ? `${s.tonerStatus}%` : "No", VCON: s.vcon,
      SubmittedAt: s.submittedAt?.toDate ? format(s.submittedAt.toDate(), "yyyy-MM-dd HH:mm:ss") : "",
    }))), "Submissions");
    XLSX.writeFile(wb, `all_projects_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Super Admin Panel</h1>
        <Button onClick={exportAll}><Download className="h-4 w-4 mr-1" />Export All</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Employees" value={employees.length} />
        <StatCard label="Submissions" value={submissions.length} />
      </div>

      <ProjectsSection projects={projects} reload={load} />
      <AdminsSection projects={projects} employees={employees} reload={load} />
      <div className="flex flex-wrap gap-2">
        <CreateAdminDialog projects={projects} onCreated={load} />
        <CreateEmployeeDialog projects={projects} onCreated={load} />
      </div>
      <EmployeesView employees={employees} />
      <EmailRecipientsSection projects={projects} />
      <SendNowSection />
    </div>
  );
}

function CreateAdminDialog({ projects, onCreated }: { projects: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", employeeID: "", email: "", password: "", location: "", projectId: "" });
  const reset = () => setForm({ name: "", employeeID: "", email: "", password: "", location: "", projectId: "" });

  const submit = async () => {
    const { name, employeeID, email, password, location, projectId } = form;
    if (!name || !employeeID || !email || !password || !location || !projectId) {
      toast.error("All fields are required"); return;
    }
    if (password.length < 6) { toast.error("Password must be 6+ chars"); return; }
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    setBusy(true);
    try {
      await createAppUser({
        name, employeeID, email, password, location,
        role: "admin",
        projectId: project.id,
        projectName: project.name,
        adminProjects: [project.id],
      });
      toast.success("Admin created");
      reset(); setOpen(false); onCreated();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary"><ShieldPlus className="h-4 w-4 mr-1" />New Admin</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Project Admin</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employee ID</Label><Input value={form.employeeID} onChange={(e) => setForm({ ...form, employeeID: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Initial Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" /></div>
          <div>
            <Label>Primary Project</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Assign more projects later from the Project Admins section.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}

function ProjectsSection({ projects, reload }: { projects: any[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    try {
      if (editing) {
        await updateDoc(doc(db, "projects", editing.id), { name });
        toast.success("Project updated");
      } else {
        await addDoc(collection(db, "projects"), { name, createdAt: serverTimestamp() });
        toast.success("Project created");
      }
      setOpen(false); setName(""); setEditing(null);
      reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    await deleteDoc(doc(db, "projects", id));
    toast.success("Deleted");
    reload();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Projects</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setName(""); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Project" : "Create Project"}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <DialogFooter><Button onClick={submit}>{editing ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Daily Email</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {projects.map((p) => {
              const enabled = p.emailEnabled !== false;
              return (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="font-mono text-xs">{p.id}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={async (v) => {
                        try {
                          await updateDoc(doc(db, "projects", p.id), { emailEnabled: v });
                          toast.success(v ? "Daily email enabled" : "Daily email disabled");
                          reload();
                        } catch (e: any) { toast.error(e?.message); }
                      }}
                    />
                    {enabled
                      ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />On</span>
                      : <span className="text-xs text-muted-foreground flex items-center gap-1"><MailX className="h-3 w-3" />Off</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setName(p.name); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>

      </CardContent>
    </Card>
  );
}

function AdminsSection({ projects, employees, reload }: { projects: any[]; employees: any[]; reload: () => void }) {
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState("");

  const admins = employees.filter((e) => e.role === "admin");

  const assign = async () => {
    if (!email.trim() || !projectId) { toast.error("Email and project required"); return; }
    const q = query(collection(db, "employees"), where("email", "==", email.trim().toLowerCase()), where("role", "==", "admin"));
    const snap = await getDocs(q);
    if (snap.empty) { toast.error("No admin found with that email. Create the admin user first."); return; }
    await updateDoc(doc(db, "employees", snap.docs[0].id), { adminProjects: arrayUnion(projectId) });
    toast.success("Project assigned");
    setEmail(""); setProjectId("");
    reload();
  };

  const removeProj = async (adminId: string, pid: string) => {
    await updateDoc(doc(db, "employees", adminId), { adminProjects: arrayRemove(pid) });
    toast.success("Removed");
    reload();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Project Admins</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2 items-end">
          <div><Label>Admin Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" /></div>
          <div>
            <Label>Project</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Select project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Button onClick={assign}><UserPlus className="h-4 w-4 mr-1" />Assign</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Projects</TableHead></TableRow></TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(a.adminProjects || []).map((pid: string) => {
                      const p = projects.find((x) => x.id === pid);
                      return (
                        <Badge key={pid} variant="secondary" className="gap-1">
                          {p?.name || pid}
                          <button onClick={() => removeProj(a.id, pid)}><UserMinus className="h-3 w-3" /></button>
                        </Badge>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmployeesView({ employees }: { employees: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">All Employees</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Branches</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell>{e.employeeID}</TableCell>
                  <TableCell>{e.email}</TableCell>
                  <TableCell><Badge variant="outline">{e.role}</Badge></TableCell>
                  <TableCell>{e.projectName}</TableCell>
                  <TableCell>{e.location}</TableCell>
                  <TableCell className="text-xs">{(e.branches || []).join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
