import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createAppUser, nameKey } from "@/lib/user-admin";
import { ForceChangePasswordDialog } from "@/components/ForceChangePasswordDialog";

export const Route = createFileRoute("/admin/employees")({
  component: () => (
    <RequireRole roles={["admin", "superadmin"]}>
      <AppShell><AdminEmployees /></AppShell>
    </RequireRole>
  ),
});

function AdminEmployees() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const myProjectIds = useMemo(() => {
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, es] = await Promise.all([
        getDocs(collection(db, "projects")),
        getDocs(collection(db, "employees")),
      ]);
      let projs = ps.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      if (myProjectIds) projs = projs.filter((p) => myProjectIds.includes(p.id));
      setProjects(projs);

      const scope = projs.map((p) => p.id);
      const emps = es.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((e) => e.role === "employee" && scope.includes(e.projectId));
      setEmployees(emps);

      // Backfill public lookup for employees so name-only login flow works seamlessly
      await Promise.all(
        emps.map((e) => {
          const authEmail = e.authEmail || e.email;
          if (!e.name || !authEmail) return Promise.resolve();
          const loginData = { email: authEmail, uid: e.id, name: e.name };
          const p1 = setDoc(doc(db, "employeeLogins", nameKey(e.name)), loginData, { merge: true }).catch(() => {});
          const p2 = e.employeeID
            ? setDoc(doc(db, "employeeLogins", nameKey(e.employeeID)), loginData, { merge: true }).catch(() => {})
            : Promise.resolve();
          return Promise.all([p1, p2]);
        }),
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [myProjectIds]);

  useEffect(() => { load(); }, [load]);

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="section-label text-sm">Manage employees in your projects</p>
        </div>
        <CreateEmployeeDialog projects={projects} onCreated={load} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{employees.length} employee(s)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Employee ID</TableHead>
                <TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Branches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <EmployeeRow key={e.id} emp={e} reload={load} />
                ))}
                {!loading && employees.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No employees yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmployeeRow({ emp, reload }: { emp: any; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState((emp.branches || []).join(", "));
  const [location, setLocation] = useState(emp.location || "");

  const save = async () => {
    try {
      await updateDoc(doc(db, "employees", emp.id), {
        branches: branches.split(",").map((s: string) => s.trim()).filter(Boolean),
        location: location.trim(),
      });
      toast.success("Updated");
      setOpen(false);
      reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  const remove = async () => {
    if (!confirm(`Remove ${emp.name}? Their login will no longer work in this app (auth account remains in Firebase).`)) return;
    try {
      await deleteDoc(doc(db, "employees", emp.id));
      if (emp.name) await deleteDoc(doc(db, "employeeLogins", nameKey(emp.name))).catch(() => {});
      if (emp.employeeID) await deleteDoc(doc(db, "employeeLogins", nameKey(emp.employeeID))).catch(() => {});
      toast.success("Removed");
      reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{emp.name}</TableCell>
      <TableCell className="font-mono text-xs">{emp.employeeID}</TableCell>
      <TableCell>{emp.projectName}</TableCell>
      <TableCell>{emp.location}</TableCell>
      <TableCell className="text-xs">{(emp.branches || []).join(", ") || "-"}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" title="Edit branches and location"><Pencil className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit {emp.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
              <div><Label>Branches (comma separated)</Label><Input value={branches} onChange={(e) => setBranches(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <ForceChangePasswordDialog user={emp} onUpdated={reload} />
        <Button size="sm" variant="ghost" onClick={remove} title="Delete employee"><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </TableCell>
    </TableRow>
  );
}

export function CreateEmployeeDialog({
  projects,
  onCreated,
}: {
  projects: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "", employeeID: "", password: "", location: "",
    projectId: "", branches: "",
  });

  const reset = () => setForm({ name: "", employeeID: "", password: "", location: "", projectId: "", branches: "" });

  const submit = async () => {
    const { name, employeeID, password, location, projectId, branches } = form;
    if (!name.trim() || !employeeID.trim() || !password || !location.trim() || !projectId) {
      toast.error("Full name, employee ID, location, password, and project are required"); return;
    }
    if (password.length < 6) { toast.error("Password must be 6+ chars"); return; }
    const project = projects.find((p) => p.id === projectId);
    if (!project) { toast.error("Pick a project"); return; }

    setBusy(true);
    try {
      await createAppUser({
        name: name.trim(),
        employeeID: employeeID.trim(),
        password,
        location: location.trim(),
        role: "employee",
        projectId: project.id,
        projectName: project.name,
        branches: branches.split(",").map((s: string) => s.trim()).filter(Boolean),
      });
      toast.success("Employee created successfully");
      reset(); setOpen(false); onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create employee");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="h-4 w-4 mr-1" />New Employee</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Employee</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Employees log in with their Name and Password. No email address is required.
        </p>
        <div className="grid gap-3 pt-1">
          <div><Label>Full Name (Employee Login Name)</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ramesh Kumar" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employee ID</Label><Input value={form.employeeID} onChange={(e) => setForm({ ...form, employeeID: e.target.value })} placeholder="EMP-101" /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Chennai / Branch HQ" /></div>
          </div>
          <div><Label>Initial Password</Label><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" /></div>
          <div>
            <Label>Project</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Branches (comma separated)</Label><Input value={form.branches} onChange={(e) => setForm({ ...form, branches: e.target.value })} placeholder="Branch A, Branch B" /></div>
        </div>
        <DialogFooter className="mt-2"><Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create Employee"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
