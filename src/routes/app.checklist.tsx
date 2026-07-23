import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Wifi, Cable, Printer, Droplet, Monitor } from "lucide-react";

export const Route = createFileRoute("/app/checklist")({
  component: () => (
    <RequireRole roles={["employee"]}>
      <AppShell>
        <ChecklistForm />
      </AppShell>
    </RequireRole>
  ),
});

type Status = "Working" | "Not Working" | "NA";
type YesNo = "Yes" | "No";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function ChecklistForm() {
  const { profile, user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [now, setNow] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [branch, setBranch] = useState("");
  const [wifi, setWifi] = useState<Status | "">("");
  const [wifiProblem, setWifiProblem] = useState("");
  const [lan, setLan] = useState<Status | "">("");
  const [lanProblem, setLanProblem] = useState("");
  const [printer, setPrinter] = useState<Status | "">("");
  const [printerIP, setPrinterIP] = useState("");
  const [printerProblem, setPrinterProblem] = useState("");
  const [tonerAvailable, setTonerAvailable] = useState<YesNo | "">("");
  const [tonerStatus, setTonerStatus] = useState<string>("");
  const [vcon, setVcon] = useState<Status | "">("");
  const [vconProblem, setVconProblem] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const q = query(
        collection(db, "checklists"),
        where("uid", "==", user.uid),
        where("date", "==", today)
      );
      const snap = await getDocs(q);
      if (!snap.empty) setAlreadyDone(true);
    })();
  }, [user, today]);

  const branches = profile?.branches || [];

  const wifiOk = wifi === "Working" || wifi === "NA" || (wifi === "Not Working" && wifiProblem.trim().length > 0);
  const lanOk = lan === "Working" || lan === "NA" || (lan === "Not Working" && lanProblem.trim().length > 0);
  const printerOk =
    printer === "NA" ||
    (printer === "Working" && printerIP.trim().length > 0) ||
    (printer === "Not Working" && printerProblem.trim().length > 0);
  const tonerOk =
    tonerAvailable === "No" ||
    (tonerAvailable === "Yes" && tonerStatus !== "" && Number(tonerStatus) >= 0 && Number(tonerStatus) <= 100);
  const vconOk = vcon === "Working" || vcon === "NA" || (vcon === "Not Working" && vconProblem.trim().length > 0);

  const showWifi = branch !== "";
  const showLan = showWifi && wifi !== "" && wifiOk;
  const showPrinter = showLan && lan !== "" && lanOk;
  const showToner = showPrinter && printer !== "" && printerOk;
  const showVcon = showToner && tonerAvailable !== "" && tonerOk;
  const allValid =
    branch && wifi && lan && printer && tonerAvailable && vcon && wifiOk && lanOk && printerOk && tonerOk && vconOk;

  const handleSubmit = async () => {
    if (!user || !profile || !allValid) return;
    setSubmitting(true);
    try {
      const docId = `${user.uid}_${today}`;
      const ref = doc(db, "checklists", docId);
      await setDoc(ref, {
        uid: user.uid,
        employeeID: profile.employeeID,
        employeeName: profile.name,
        projectId: profile.projectId,
        projectName: profile.projectName,
        branch,
        date: today,
        wifi,
        wifiProblem: wifi === "Not Working" ? wifiProblem : "",
        lan,
        lanProblem: lan === "Not Working" ? lanProblem : "",
        printer,
        printerIP: printer === "Working" ? printerIP : "",
        printerProblem: printer === "Not Working" ? printerProblem : "",
        tonerAvailable,
        tonerStatus: tonerAvailable === "Yes" ? Number(tonerStatus) : null,
        vcon,
        vconProblem: vcon === "Not Working" ? vconProblem : "",
        submittedAt: serverTimestamp(),
      });
      toast.success("Branch IT Daily Checklist submitted successfully.");
      setAlreadyDone(true);
    } catch (err: any) {
      toast.error(err?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadyDone) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="max-w-xl mx-auto mt-10">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-semibold">You're done for today</h2>
            <p className="text-muted-foreground">Today's Branch IT Daily Checklist has been submitted.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="page-title">Daily Checklist</h1>
        <p className="section-label text-sm">Complete each section in order.</p>
      </motion.div>

      <Card>
        <CardHeader><CardTitle className="text-base">General Information</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input readOnly value={today} />
            </div>
            <div>
              <Label>Submission Time (preview)</Label>
              <Input readOnly value={format(now, "HH:mm:ss")} />
            </div>
          </div>
          <div>
            <Label>Employee Name</Label>
            <Input readOnly value={profile?.name || ""} />
          </div>
          <div>
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches.length === 0 && <SelectItem value="__none" disabled>No branches assigned</SelectItem>}
                {branches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {showWifi && (
          <motion.div key="wifi" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wifi className="h-4 w-4" />WiFi</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <StatusRadio value={wifi} onChange={(v) => setWifi(v as Status)} />
                {wifi === "Not Working" && (
                  <div>
                    <Label>WiFi Problem</Label>
                    <Textarea value={wifiProblem} onChange={(e) => setWifiProblem(e.target.value)} required />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showLan && (
          <motion.div key="lan" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cable className="h-4 w-4" />LAN</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <StatusRadio value={lan} onChange={(v) => setLan(v as Status)} />
                {lan === "Not Working" && (
                  <div>
                    <Label>LAN Problem</Label>
                    <Textarea value={lanProblem} onChange={(e) => setLanProblem(e.target.value)} required />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showPrinter && (
          <motion.div key="printer" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Printer</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <StatusRadio value={printer} onChange={(v) => setPrinter(v as Status)} />
                {printer === "Working" && (
                  <div>
                    <Label>Printer IP</Label>
                    <Input value={printerIP} onChange={(e) => setPrinterIP(e.target.value)} placeholder="192.168.1.10" required />
                  </div>
                )}
                {printer === "Not Working" && (
                  <div>
                    <Label>Printer Problem</Label>
                    <Textarea value={printerProblem} onChange={(e) => setPrinterProblem(e.target.value)} required />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showToner && (
          <motion.div key="toner" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Droplet className="h-4 w-4" />Toner Available</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <RadioGroup value={tonerAvailable} onValueChange={(v) => setTonerAvailable(v as YesNo)} className="flex gap-4">
                  {(["Yes", "No"] as YesNo[]).map((o) => (
                    <label key={o} className="flex items-center gap-2 cursor-pointer">
                      <RadioGroupItem value={o} />{o}
                    </label>
                  ))}
                </RadioGroup>
                {tonerAvailable === "Yes" && (
                  <div>
                    <Label>Toner Status %</Label>
                    <Input type="number" min={0} max={100} value={tonerStatus} onChange={(e) => setTonerStatus(e.target.value)} required />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showVcon && (
          <motion.div key="vcon" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" />VCON / Laptop Room</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <StatusRadio value={vcon} onChange={(v) => setVcon(v as Status)} />
                {vcon === "Not Working" && (
                  <div>
                    <Label>VCON Problem</Label>
                    <Textarea value={vconProblem} onChange={(e) => setVconProblem(e.target.value)} required />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={handleSubmit}
        disabled={!allValid || submitting}
        className="w-full h-11"
        style={allValid ? { background: "var(--gradient-primary)" } : undefined}
      >
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Submit Checklist
      </Button>
    </div>
  );
}

function StatusRadio({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts: Status[] = ["Working", "Not Working", "NA"];
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
      {opts.map((o) => (
        <label key={o} className="flex items-center gap-2 cursor-pointer">
          <RadioGroupItem value={o} />{o}
        </label>
      ))}
    </RadioGroup>
  );
}
