import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { nameKey } from "@/lib/user-admin";
import { auth, db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Shield, UserCog, User } from "lucide-react";
import { motion } from "framer-motion";
import tvseLogo from "@/assets/tvse-logo.svg";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSaPassword, setShowSaPassword] = useState(false);
  const [showAPassword, setShowAPassword] = useState(false);
  const [showEPassword, setShowEPassword] = useState(false);

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
    toast.success(`Welcome, ${p.name || p.email || "User"}`);
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
      if (!key) throw new Error("Enter your employee name.");
      let lookup = await getDoc(doc(db, "employeeLogins", key));
      if (!lookup.exists()) {
        // Fallback: check if they entered employeeID instead of name
        const qEmp = query(collection(db, "employees"), where("employeeID", "==", eName.trim()));
        const snapEmp = await getDocs(qEmp);
        if (!snapEmp.empty) {
          const empDoc = snapEmp.docs[0].data();
          if (empDoc.name) {
            lookup = await getDoc(doc(db, "employeeLogins", nameKey(empDoc.name)));
          }
        }
      }
      if (!lookup.exists()) throw new Error("Employee name not found. Ask Super Admin to check your account or reset password.");
      const { email } = lookup.data() as { email?: string };
      if (!email) throw new Error("Employee record missing login credential. Contact Super Admin.");
      const cred = await signInWithEmailAndPassword(auth, email, ePass);
      await finish(cred.user.uid, "employee");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-10 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute right-[-10%] bottom-16 h-80 w-80 rounded-full bg-blue-400/15 blur-3xl" />
      </div>
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle showLabel variant="secondary" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <Card className="hero-card border-0 overflow-hidden">
          <CardHeader className="text-center space-y-4">
            <img src={tvseLogo} alt="TVS Electronics logo" className="mx-auto h-16 w-auto" />
            <div>
              <CardTitle className="text-2xl">Branch IT Daily Checklist</CardTitle>
              <CardDescription>TVS Electronics employee checklist portal</CardDescription>
            </div>
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
                    <Label>Employee Name</Label>
                    <Input
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      placeholder="Your full name (e.g. Ramesh Kumar)"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <div className="relative">
                      <Input
                        type={showEPassword ? "text" : "password"}
                        value={ePass}
                        onChange={(e) => setEPass(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showEPassword ? "Hide password" : "Show password"}
                      >
                        {showEPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                    <div className="relative">
                      <Input type={showAPassword ? "text" : "password"} value={aPass} onChange={(e) => setAPass(e.target.value)} required />
                      <button
                        type="button"
                        onClick={() => setShowAPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showAPassword ? "Hide password" : "Show password"}
                      >
                        {showAPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                    <div className="relative">
                      <Input type={showSaPassword ? "text" : "password"} value={saPass} onChange={(e) => setSaPass(e.target.value)} required />
                      <button
                        type="button"
                        onClick={() => setShowSaPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showSaPassword ? "Hide password" : "Show password"}
                      >
                        {showSaPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
