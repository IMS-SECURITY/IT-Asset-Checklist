import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export function EmailRecipientsSection({ projects }: { projects: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState("");

  const load = useCallback(async () => {
    const snap = await getDocs(collection(db, "emailRecipients"));
    setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Enter a valid email"); return;
    }
    try {
      await addDoc(collection(db, "emailRecipients"), {
        email: clean,
        projectId: projectId || "",
      });
      toast.success("Recipient added");
      setEmail(""); setProjectId("");
      load();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this recipient?")) return;
    await deleteDoc(doc(db, "emailRecipients", id));
    toast.success("Removed");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" /> Daily Email Recipients
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          These addresses receive the 11:00 AM daily summary in addition to project admins and super admins.
          Leave project as "All projects" to receive a mail for every project.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2 items-end">
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div>
            <Label>Project (optional)</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />Add</Button>
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Email</TableHead><TableHead>Scope</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                No extra recipients configured.
              </TableCell></TableRow>
            ) : rows.map((r) => {
              const p = r.projectId ? projects.find((x) => x.id === r.projectId) : null;
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p ? p.name : "All projects"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
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
