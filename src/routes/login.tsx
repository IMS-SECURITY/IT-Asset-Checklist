import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { nameKey } from "@/lib/user-admin";
import { auth, db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, UserCog, User } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // super
  const [saEmail, setSaEmail] = useState("");
  const [saPass, setSaPass] = useState("");

  // admin
  const [aEmail, setAEmail] = useState("");
  const [aPass, setAPass] = useState("");

  // employee
  const [eName, setEName] = useState("");
  const [ePass, setEPass] = useState("");

  const finish = async (uid: string, requiredRole: string, projectIdCheck?: string, locationCheck?: string) => {
    const snap = await getDoc(doc(db, "employees", uid));
    if (!snap.exists()) throw new Error("Profile not found. Contact admin.");
    const p: any = snap.data();
    if (p.role !== requiredRole) {
      await auth.signOut();
      throw new Error(`This account is not a ${requiredRole}.`);
    }
    if (projectIdCheck) {
      const adminProjects: string[] = p.adminProjects || [];
      if (!adminProjects.includes(projectIdCheck)) {
        await auth.signOut();
        throw new Error("Project ID not assigned to this admin.");
      }
    }
    if (locationCheck && p.location?.toLowerCase() !== locationCheck.toLowerCase()) {
      await auth.signOut();
      throw new Error("Location does not match this employee.");
    }
    toast.success(`Welcome, ${p.name}`);
    if (p.role === "superadmin") navigate({ to: "/super" });
    else if (p.role === "admin") navigate({ to: "/admin/checklist" });
    else navigate({ to: "/app/checklist" });
  };

  const handleSuper = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, saEmail, saPass);
      await finish(cred.user.uid, "superadmin");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, aEmail, aPass);
      await finish(cred.user.uid, "admin");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const key = nameKey(eName);
      if (!key) throw new Error("Enter your name.");
      const lookup = await getDoc(doc(db, "employeeLogins", key));
      if (!lookup.exists()) throw new Error("Employee name not found. Ask your admin to (re)create your login.");
      const { email } = lookup.data() as { email?: string };
      if (!email) throw new Error("Employee record missing email.");
      const cred = await signInWithEmailAndPassword(auth, email, ePass);
      await finish(cred.user.uid, "employee");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--gradient-primary)" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Branch IT Daily Checklist</CardTitle>
            <CardDescription>Sign in to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="employee" className="w-full">
              <TabsList className="grid grid-cols-3 w-full mb-4">
                <TabsTrigger value="employee"><User className="h-4 w-4 mr-1" />Employee</TabsTrigger>
                <TabsTrigger value="admin"><UserCog className="h-4 w-4 mr-1" />Admin</TabsTrigger>
                <TabsTrigger value="super"><Shield className="h-4 w-4 mr-1" />Super</TabsTrigger>
              </TabsList>

              <TabsContent value="employee">
                <form onSubmit={handleEmployee} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Your full name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={ePass} onChange={(e) => setEPass(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="admin">
                <form onSubmit={handleAdmin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={aEmail} onChange={(e) => setAEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={aPass} onChange={(e) => setAPass(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="super">
                <form onSubmit={handleSuper} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={saEmail} onChange={(e) => setSaEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={saPass} onChange={(e) => setSaPass(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Sign In
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
