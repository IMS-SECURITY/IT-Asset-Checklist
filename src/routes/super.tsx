import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
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
import {
  Plus, Pencil, Trash2, UserPlus, UserMinus, Download, ShieldPlus, Mail, MailX,
  ShieldAlert, ShieldCheck, KeyRound, Search, UserCog, User, Shield,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";

import { toast } from "sonner";
import { createAppUser, updateUserRole, sendResetEmail, nameKey } from "@/lib/user-admin";
import type { Role } from "@/lib/types";
import { CreateEmployeeDialog } from "./admin.employees";
import { ForceChangePasswordDialog } from "@/components/ForceChangePasswordDialog";
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

  const superAdminCount = useMemo(() => employees.filter((e) => e.role === "superadmin").length, [employees]);
  const adminCount = useMemo(() => employees.filter((e) => e.role === "admin").length, [employees]);
  const employeeCount = useMemo(() => employees.filter((e) => e.role === "employee").length, [employees]);

  const exportAll = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projects.map((p) => ({ ID: p.id, Name: p.name }))), "Projects");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(employees.map((e) => ({
      UID: e.id, EmployeeID: e.employeeID, Name: e.name, Email: e.email, Role: e.role,
      Project: e.projectName, Location: e.location, Branches: (e.branches || []).join(", "),
      AdminProjects: (e.adminProjects || []).join(", "),
    }))), "Users");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(submissions.map((s) => ({
      Date: s.date, Project: s.projectName, Branch: s.branch, EmployeeID: s.employeeID, Employee: s.employeeName,
      WiFi: s.wifi, LAN: s.lan, Printer: s.printer, Toner: s.tonerAvailable === "Yes" ? `${s.tonerStatus}%` : "No", VCON: s.vcon,
      SubmittedAt: s.submittedAt?.toDate ? format(s.submittedAt.toDate(), "yyyy-MM-dd HH:mm:ss") : "",
    }))), "Submissions");
    XLSX.writeFile(wb, `all_projects_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Super Admin Panel</h1>
          <p className="section-label text-sm">System administration & access control</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={exportAll} variant="outline"><Download className="h-4 w-4 mr-1" />Export All</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Projects" value={projects.length} />
        <StatCard label="Super Admins" value={superAdminCount} />
        <StatCard label="Project Admins" value={adminCount} />
        <StatCard label="Employees" value={employeeCount} />
        <StatCard label="Submissions" value={submissions.length} />
      </div>

      <ProjectsSection projects={projects} reload={load} />
      <AdminsSection projects={projects} employees={employees} reload={load} />

      <UsersManagementSection
        employees={employees}
        projects={projects}
        reload={load}
      />

      <EmailRecipientsSection projects={projects} />
      <SendNowSection />
    </motion.div>
  );
}

export function CreateSuperAdminDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", employeeID: "", email: "", password: "", location: "" });
  const reset = () => setForm({ name: "", employeeID: "", email: "", password: "", location: "" });

  const submit = async () => {
    const { name, employeeID, email, password, location } = form;
    if (!name || !employeeID || !email || !password || !location) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await createAppUser({
        name,
        employeeID,
        email,
        password,
        location,
        role: "superadmin",
        projectId: "",
        projectName: "",
        adminProjects: [],
        branches: [],
      });
      toast.success(`Super Admin "${name}" created successfully`);
      reset();
      setOpen(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create super admin");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
          <ShieldAlert className="h-4 w-4 mr-1" />New Super Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            <span>Create New Super Admin</span>
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Super Admins have full access to all projects, checklists, admin controls, and email reports.
        </p>
        <div className="grid gap-3 pt-2">
          <div>
            <Label>Full Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Sharma" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Employee ID</Label>
              <Input value={form.employeeID} onChange={(e) => setForm({ ...form, employeeID: e.target.value })} placeholder="SUPER-002" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="HQ / Chennai" />
            </div>
          </div>
          <div>
            <Label>Email (Sign-in ID)</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="superadmin@company.com" />
          </div>
          <div>
            <Label>Initial Password</Label>
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-purple-600 hover:bg-purple-700 text-white">
            {busy ? "Creating..." : "Create Super Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
            <p className="text-xs text-muted-foreground mt-1">Assign more projects later from the Project Admins or Users section.</p>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditUserRoleDialog({
  user,
  projects,
  onUpdated,
}: {
  user: any;
  projects: any[];
  onUpdated: () => void;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<Role>(user.role || "employee");
  const [name, setName] = useState(user.name || "");
  const [employeeID, setEmployeeID] = useState(user.employeeID || "");
  const [email, setEmail] = useState(user.email || "");
  const [location, setLocation] = useState(user.location || "");
  const [projectId, setProjectId] = useState(user.projectId || "");
  const [adminProjects, setAdminProjects] = useState<string[]>(
    user.adminProjects || (user.projectId ? [user.projectId] : [])
  );
  const [branches, setBranches] = useState((user.branches || []).join(", "));

  useEffect(() => {
    if (open) {
      setRole(user.role || "employee");
      setName(user.name || "");
      setEmployeeID(user.employeeID || "");
      setEmail(user.email || "");
      setLocation(user.location || "");
      setProjectId(user.projectId || "");
      setAdminProjects(user.adminProjects || (user.projectId ? [user.projectId] : []));
      setBranches((user.branches || []).join(", "));
    }
  }, [open, user]);

  const toggleAdminProject = (pid: string) => {
    setAdminProjects((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !employeeID.trim()) {
      toast.error("Name and Employee ID are required");
      return;
    }

    if ((role === "admin" || role === "superadmin") && !email.trim()) {
      toast.error("Email is required for Admin and Super Admin sign-in");
      return;
    }

    if (profile?.uid === user.id && user.role === "superadmin" && role !== "superadmin") {
      const confirmDemote = confirm("Warning: You are changing your OWN role away from Super Admin! You may lose access to this panel. Are you sure?");
      if (!confirmDemote) return;
    }

    const selectedProj = projects.find((p) => p.id === projectId);
    const projectName = selectedProj ? selectedProj.name : user.projectName || "";

    setBusy(true);
    try {
      await updateUserRole({
        uid: user.id,
        name,
        employeeID,
        email: role === "employee" ? "" : email.trim().toLowerCase(),
        location,
        role,
        projectId: role === "superadmin" ? "" : projectId,
        projectName: role === "superadmin" ? "" : projectName,
        adminProjects: role === "admin" ? adminProjects : [],
        branches: role === "employee" ? branches.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      });
      toast.success(`Role and profile for "${name}" updated to ${role}`);
      setOpen(false);
      onUpdated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update role");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Edit User & Role">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <span>Edit User & Role — {user.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Role selector */}
          <div className="p-3 bg-muted/40 rounded-lg space-y-2 border">
            <Label className="text-sm font-semibold">User Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="superadmin">
                  <span className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-purple-600" />
                    <strong>Super Admin</strong> (Full unrestricted access)
                  </span>
                </SelectItem>
                <SelectItem value="admin">
                  <span className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-indigo-600" />
                    <strong>Project Admin</strong> (Manages assigned projects)
                  </span>
                </SelectItem>
                <SelectItem value="employee">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-600" />
                    <strong>Employee</strong> (Submits daily checklists)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {role === "superadmin" && "Super Admins can manage all projects, admins, employees, and settings."}
              {role === "admin" && "Project Admins can view dashboards and manage employees for assigned projects."}
              {role === "employee" && "Employees sign in to submit their daily branch IT checklists."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Employee ID</Label>
              <Input value={employeeID} onChange={(e) => setEmployeeID(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email {role === "employee" ? "(Not required)" : "(Sign-in email)"}</Label>
              <Input
                value={role === "employee" ? "" : email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={role === "employee"}
                placeholder={role === "employee" ? "No email required (Name login)" : "admin@example.com"}
                className={role === "employee" ? "bg-muted text-muted-foreground" : ""}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          {/* Conditional role fields */}
          {role === "admin" && (
            <div className="space-y-3 p-3 border rounded-lg bg-indigo-50/30 dark:bg-indigo-950/20">
              <div>
                <Label>Primary Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select primary project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="block mb-1">Assigned Projects (Admin can view dashboards for these)</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {projects.map((p) => {
                    const isSelected = adminProjects.includes(p.id);
                    return (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={isSelected ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
                        onClick={() => toggleAdminProject(p.id)}
                      >
                        {isSelected ? "✓ " : "+ "}{p.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {role === "employee" && (
            <div className="space-y-3 p-3 border rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20">
              <div>
                <Label>Assigned Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Branches (comma separated)</Label>
                <Input value={branches} onChange={(e) => setBranches(e.target.value)} placeholder="Branch A, Branch B, HQ" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>{busy ? "Saving..." : "Save Changes"}</Button>
        </DialogFooter>
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
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.id}</TableCell>
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
      <CardHeader><CardTitle className="text-base">Project Admins Assignment</CardTitle></CardHeader>
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
          <Button onClick={assign}><UserPlus className="h-4 w-4 mr-1" />Assign Project</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Assigned Projects</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No project admins created yet</TableCell></TableRow>
            ) : (
              admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-xs">{a.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(a.adminProjects || []).map((pid: string) => {
                        const p = projects.find((x) => x.id === pid);
                        return (
                          <Badge key={pid} variant="secondary" className="gap-1">
                            {p?.name || pid}
                            <button onClick={() => removeProj(a.id, pid)} title="Remove project"><UserMinus className="h-3 w-3" /></button>
                          </Badge>
                        );
                      })}
                      {(!a.adminProjects || a.adminProjects.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">None assigned (sees all)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <EditUserRoleDialog user={a} projects={projects} onUpdated={reload} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersManagementSection({
  employees,
  projects,
  reload,
}: {
  employees: any[];
  projects: any[];
  reload: () => void;
}) {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const filteredUsers = useMemo(() => {
    return employees.filter((e) => {
      // Role filter
      if (roleFilter !== "all" && e.role !== roleFilter) return false;
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = e.name?.toLowerCase().includes(q);
        const matchesEmail = e.email?.toLowerCase().includes(q);
        const matchesID = e.employeeID?.toLowerCase().includes(q);
        const matchesProject = e.projectName?.toLowerCase().includes(q);
        const matchesLocation = e.location?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesID && !matchesProject && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [employees, roleFilter, search]);

  const handleResetPassword = async (email: string) => {
    if (!email) return;
    try {
      await sendResetEmail(email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reset email");
    }
  };

  const handleDeleteUser = async (u: any) => {
    if (!confirm(`Delete user "${u.name}" (${u.role})? Their login record will be removed.`)) return;
    try {
      await deleteDoc(doc(db, "employees", u.id));
      if (u.name) {
        await deleteDoc(doc(db, "employeeLogins", nameKey(u.name))).catch(() => {});
      }
      toast.success(`User "${u.name}" deleted successfully`);
      reload();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete user");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <span>Users & Role Management ({employees.length})</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add Super Admins, Project Admins, Employees, and edit user roles
          </p>
        </div>

        {/* Action Buttons to Add Users */}
        <div className="flex flex-wrap gap-2">
          <CreateSuperAdminDialog onCreated={reload} />
          <CreateAdminDialog projects={projects} onCreated={reload} />
          <CreateEmployeeDialog projects={projects} onCreated={reload} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={roleFilter === "all" ? "default" : "outline"}
              onClick={() => setRoleFilter("all")}
            >
              All ({employees.length})
            </Button>
            <Button
              size="sm"
              variant={roleFilter === "superadmin" ? "default" : "outline"}
              className={roleFilter === "superadmin" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}
              onClick={() => setRoleFilter("superadmin")}
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1" />
              Super Admins ({employees.filter((e) => e.role === "superadmin").length})
            </Button>
            <Button
              size="sm"
              variant={roleFilter === "admin" ? "default" : "outline"}
              className={roleFilter === "admin" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}
              onClick={() => setRoleFilter("admin")}
            >
              <UserCog className="h-3.5 w-3.5 mr-1" />
              Admins ({employees.filter((e) => e.role === "admin").length})
            </Button>
            <Button
              size="sm"
              variant={roleFilter === "employee" ? "default" : "outline"}
              className={roleFilter === "employee" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              onClick={() => setRoleFilter("employee")}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              Employees ({employees.filter((e) => e.role === "employee").length})
            </Button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User / Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Project / Scope</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                    No users match the selected role or search query
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const roleBadge =
                    u.role === "superadmin" ? (
                      <Badge className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1 w-fit">
                        <ShieldAlert className="h-3 w-3" />Super Admin
                      </Badge>
                    ) : u.role === "admin" ? (
                      <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 w-fit">
                        <UserCog className="h-3 w-3" />Project Admin
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 w-fit">
                        <User className="h-3 w-3" />Employee
                      </Badge>
                    );

                  return (
                    <TableRow key={u.id} className="hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <div>{u.name}</div>
                        {u.role === "superadmin" && (
                          <div className="text-[10px] text-purple-600 font-semibold uppercase tracking-wider">Super Administrator</div>
                        )}
                      </TableCell>
                      <TableCell>{roleBadge}</TableCell>
                      <TableCell className="font-mono text-xs">{u.employeeID}</TableCell>
                      <TableCell className="text-xs">
                        {u.email ? (
                          u.email
                        ) : (
                          <span className="text-muted-foreground italic">None (Name sign in)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.role === "superadmin" ? (
                          <span className="text-xs text-muted-foreground">All Projects</span>
                        ) : u.role === "admin" ? (
                          <span className="text-xs font-medium">
                            {u.adminProjects && u.adminProjects.length > 0
                              ? `${u.adminProjects.length} project(s)`
                              : (u.projectName || "All")}
                          </span>
                        ) : (
                          <span className="text-xs">{u.projectName || "-"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{u.location || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {u.role === "employee" ? (
                          (u.branches && u.branches.length > 0) ? u.branches.join(", ") : <span className="text-muted-foreground italic">None</span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <EditUserRoleDialog user={u} projects={projects} onUpdated={reload} />
                          {u.role === "employee" ? (
                            <ForceChangePasswordDialog user={u} onUpdated={reload} />
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleResetPassword(u.email)}
                              title={u.email ? `Send Password Reset Email to ${u.email}` : "No email configured"}
                              disabled={!u.email}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(u)}
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
