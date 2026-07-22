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
import { UserPlus, Trash2, KeyRound, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createAppUser, sendResetEmail, nameKey } from "@/lib/user-admin";

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

  const myProjectIds = useMemo(
    () => (profile?.role === "superadmin" ? null : profile?.adminProjects ?? []),
    [profile],
  );

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

      // Backfill public name -> email lookup for existing employees so the
      // name-only login flow works even for accounts created before this feature.
      await Promise.all(
        emps.map((e) =>
          e.name && e.email
            ? setDoc(
                doc(db, "employeeLogins", nameKey(e.name)),
                { email: e.email, uid: e.id, name: e.name },
                { merge: true },
              ).catch(() => {})
            : Promise.resolve(),
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [myProjectIds]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage employees in your projects</p>
        </div>
        <CreateEmployeeDialog projects={projects} onCreated={load} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{employees.length} employee(s)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Email</TableHead>
                <TableHead>Project</TableHead><TableHead>Location</TableHead><TableHead>Branches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <EmployeeRow key={e.id} emp={e} reload={load} />
                ))}
                {!loading && employees.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No employees yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
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
      toast.success("Removed");
      reload();
    } catch (e: any) { toast.error(e?.message); }
  };

  const reset = async () => {
    try {
      await sendResetEmail(emp.email);
      toast.success("Password reset email sent");
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <TableRow>
      <TableCell>{emp.name}</TableCell>
      <TableCell>{emp.employeeID}</TableCell>
      <TableCell className="text-xs">{emp.email}</TableCell>
      <TableCell>{emp.projectName}</TableCell>
      <TableCell>{emp.location}</TableCell>
      <TableCell className="text-xs">{(emp.branches || []).join(", ")}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button>
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
        <Button size="sm" variant="ghost" onClick={reset} title="Send password reset"><KeyRound className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
    name: "", employeeID: "", email: "", password: "", location: "",
    projectId: "", branches: "",
  });

  const reset = () => setForm({ name: "", employeeID: "", email: "", password: "", location: "", projectId: "", branches: "" });

  const submit = async () => {
    const { name, employeeID, email, password, location, projectId, branches } = form;
    if (!name || !employeeID || !email || !password || !location || !projectId) {
      toast.error("All fields except branches are required"); return;
    }
    if (password.length < 6) { toast.error("Password must be 6+ chars"); return; }
    const project = projects.find((p) => p.id === projectId);
    if (!project) { toast.error("Pick a project"); return; }

    setBusy(true);
    try {
      await createAppUser({
        name, employeeID, email, password, location,
        role: "employee",
        projectId: project.id,
        projectName: project.name,
        branches: branches.split(",").map((s: string) => s.trim()).filter(Boolean),
      });
      toast.success("Employee created");
      reset(); setOpen(false); onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="h-4 w-4 mr-1" />New Employee</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Employee</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employee ID</Label><Input value={form.employeeID} onChange={(e) => setForm({ ...form, employeeID: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="city/region" /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
        <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
