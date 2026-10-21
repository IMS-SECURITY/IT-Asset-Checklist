import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { addDoc, collection, doc, deleteDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Wifi, Cable, Printer, Droplet, Monitor, Plus, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import type { PrinterItem, PrinterType } from "@/lib/types";
import { computeOverallPrinterStatus } from "@/lib/printer-helpers";

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
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [branch, setBranch] = useState("");
  const [wifi, setWifi] = useState<Status | "">("");
  const [wifiProblem, setWifiProblem] = useState("");
  const [lan, setLan] = useState<Status | "">("");
  const [lanProblem, setLanProblem] = useState("");

  const resetFormState = () => {
    setBranch("");
    setWifi("");
    setWifiProblem("");
    setLan("");
    setLanProblem("");
    setPrinters([
      {
        id: "1",
        status: "Working",
        ip: "",
        printerType: "Monochrome",
        blackToner: null,
        yellowToner: null,
        magentaToner: null,
        cyanToner: null,
        problem: "",
      },
    ]);
    setVcon("");
    setVconProblem("");
  };

  // Multiple Printers with combined toner status
  const [printers, setPrinters] = useState<PrinterItem[]>([
    {
      id: "1",
      status: "Working",
      ip: "",
      printerType: "Monochrome",
      blackToner: null,
      yellowToner: null,
      magentaToner: null,
      cyanToner: null,
      problem: "",
    },
  ]);

  const [vcon, setVcon] = useState<Status | "">("");
  const [vconProblem, setVconProblem] = useState("");

  const addPrinter = () => {
    setPrinters((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        status: "Working",
        ip: "",
        printerType: "Monochrome",
        blackToner: null,
        yellowToner: null,
        magentaToner: null,
        cyanToner: null,
        problem: "",
      },
    ]);
  };

  const removePrinter = (id: string) => {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePrinter = (id: string, updates: Partial<PrinterItem>) => {
    setPrinters((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  };

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

  const printersOk =
    printers.length > 0 &&
    printers.every((p) => {
      if (p.status === "NA") return true;
      if (p.status === "Not Working") {
        return Boolean(p.problem && p.problem.trim().length > 0);
      }
      if (p.status === "Working") {
        if (!p.ip || !p.ip.trim()) return false;
        if (p.printerType === "Colour") {
          return (
            p.blackToner !== null && p.blackToner !== undefined && p.blackToner >= 0 && p.blackToner <= 100 &&
            p.yellowToner !== null && p.yellowToner !== undefined && p.yellowToner >= 0 && p.yellowToner <= 100 &&
            p.magentaToner !== null && p.magentaToner !== undefined && p.magentaToner >= 0 && p.magentaToner <= 100 &&
            p.cyanToner !== null && p.cyanToner !== undefined && p.cyanToner >= 0 && p.cyanToner <= 100
          );
        } else {
          // Monochrome
          return p.blackToner !== null && p.blackToner !== undefined && p.blackToner >= 0 && p.blackToner <= 100;
        }
      }
      return false;
    });

  const vconOk = vcon === "Working" || vcon === "NA" || (vcon === "Not Working" && vconProblem.trim().length > 0);

  const showWifi = branch !== "";
  const showLan = showWifi && wifi !== "" && wifiOk;
  const showPrinters = showLan && lan !== "" && lanOk;
  const showVcon = showPrinters && printersOk;
  const allValid =
    branch && wifi && lan && printersOk && vcon && wifiOk && lanOk && vconOk;

  const handleSubmit = async () => {
    if (!user || !profile || !allValid) return;
    setSubmitting(true);
    try {
      const docId = `${user.uid}_${today}`;
      const ref = doc(db, "checklists", docId);

      const overallPrinter = computeOverallPrinterStatus(printers);
      const combinedIP = printers.map((p) => p.ip?.trim()).filter(Boolean).join(", ");
      const combinedProblems = printers
        .filter((p) => p.status === "Not Working" && p.problem)
        .map((p) => (p.ip ? `${p.ip}: ${p.problem}` : p.problem))
        .join("; ");
      const hasToner = printers.some((p) => p.status === "Working" && p.blackToner !== null);
      const primaryBlackToner = printers.find((p) => p.blackToner !== null && p.blackToner !== undefined)?.blackToner ?? null;

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
        printers,
        printer: overallPrinter,
        printerIP: combinedIP,
        printerProblem: combinedProblems,
        tonerAvailable: hasToner ? "Yes" : "No",
        tonerStatus: primaryBlackToner,
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

  const handleClearOwnEntry = async () => {
    if (!user) return;
    setClearing(true);
    try {
      const docId = `${user.uid}_${today}`;
      await deleteDoc(doc(db, "checklists", docId));
      resetFormState();
      setAlreadyDone(false);
      setConfirmClear(false);
      toast.success("Today's submission cleared. You can now fill and submit the checklist again.");
    } catch (err: any) {
      console.error("Failed to clear entry:", err);
      toast.error(err?.message || "Failed to clear checklist entry");
    } finally {
      setClearing(false);
    }
  };

  if (alreadyDone) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="max-w-xl mx-auto mt-10 shadow-md">
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
            <h2 className="text-xl font-semibold">You're done for today</h2>
            <p className="text-muted-foreground text-sm">
              Today's Branch IT Daily Checklist has already been submitted for <strong>{today}</strong>.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setConfirmClear(true)}
                disabled={clearing}
              >
                {clearing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing Entry...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Clear Entry & Resubmit
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <span>Clear Today's Checklist Entry?</span>
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2 text-sm text-foreground/80">
                <p>
                  Are you sure you want to clear your submission for today (<strong>{today}</strong>)?
                </p>
                <p className="text-xs text-muted-foreground">
                  This will remove your submission from the system and allow you to fill out and submit the checklist form again.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearOwnEntry}
                disabled={clearing}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {clearing ? "Clearing..." : "Yes, Clear Entry"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

        {showPrinters && (
          <motion.div key="printers" variants={sectionVariants} initial="hidden" animate="visible" exit="exit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Printer className="h-4 w-4 text-primary" />
                    <span>Printers & Toner Status</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record printer status, IP, and toner percentage for each printer at this location.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addPrinter} className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Printer
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {printers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="p-4 border rounded-xl bg-card/60 dark:bg-muted/20 space-y-3 relative shadow-xs"
                  >
                    <div className="flex items-center justify-between pb-1 border-b">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          Printer #{idx + 1}
                        </span>
                        {p.ip && (
                          <span className="text-xs font-mono text-muted-foreground">
                            ({p.ip})
                          </span>
                        )}
                      </div>
                      {printers.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removePrinter(p.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Remove this printer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Printer Status</Label>
                      <StatusRadio
                        value={p.status}
                        onChange={(v) => updatePrinter(p.id, { status: v as Status })}
                      />
                    </div>

                    {p.status === "Working" && (
                      <div className="space-y-3 pt-1">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Printer IP Address</Label>
                            <Input
                              value={p.ip || ""}
                              onChange={(e) => updatePrinter(p.id, { ip: e.target.value })}
                              placeholder="e.g. 10.63.192.2"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Printer Type</Label>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={p.printerType === "Monochrome" ? "default" : "outline"}
                                className={p.printerType === "Monochrome" ? "h-9 text-xs" : "h-9 text-xs"}
                                onClick={() => updatePrinter(p.id, { printerType: "Monochrome" })}
                              >
                                Monochrome (B&W)
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={p.printerType === "Colour" ? "default" : "outline"}
                                className={
                                  p.printerType === "Colour"
                                    ? "h-9 text-xs bg-gradient-to-r from-blue-600 via-pink-600 to-amber-500 text-white"
                                    : "h-9 text-xs"
                                }
                                onClick={() => updatePrinter(p.id, { printerType: "Colour" })}
                              >
                                Colour
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Combined Toner Status directly below the printer IP */}
                        {p.printerType === "Monochrome" ? (
                          <div className="p-3 border rounded-lg bg-muted/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white inline-block" />
                                Black Toner Status %
                              </Label>
                              <span className="text-xs font-mono text-muted-foreground">
                                {p.blackToner !== null && p.blackToner !== undefined ? `${p.blackToner}%` : "Not set"}
                              </span>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={p.blackToner ?? ""}
                              onChange={(e) =>
                                updatePrinter(p.id, {
                                  blackToner: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0 - 100 % (e.g. 60)"
                              required
                            />
                          </div>
                        ) : (
                          <div className="p-3 border rounded-lg bg-muted/40 space-y-2.5">
                            <Label className="text-xs font-semibold flex items-center gap-1.5">
                              <Droplet className="h-3.5 w-3.5 text-primary" />
                              Colour Toner Status % (CMYK)
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {/* Black */}
                              <div className="p-2 border rounded-md bg-background space-y-1">
                                <span className="text-[11px] font-semibold flex items-center gap-1 text-foreground">
                                  <span className="h-2 w-2 rounded-full bg-slate-900 dark:bg-white" />
                                  Black
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-8 text-xs"
                                  value={p.blackToner ?? ""}
                                  onChange={(e) =>
                                    updatePrinter(p.id, {
                                      blackToner: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0-100"
                                  required
                                />
                              </div>

                              {/* Yellow */}
                              <div className="p-2 border rounded-md bg-background space-y-1 border-amber-400/50">
                                <span className="text-[11px] font-semibold flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                                  Yellow
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-8 text-xs"
                                  value={p.yellowToner ?? ""}
                                  onChange={(e) =>
                                    updatePrinter(p.id, {
                                      yellowToner: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0-100"
                                  required
                                />
                              </div>

                              {/* Magenta */}
                              <div className="p-2 border rounded-md bg-background space-y-1 border-pink-400/50">
                                <span className="text-[11px] font-semibold flex items-center gap-1 text-pink-600 dark:text-pink-400">
                                  <span className="h-2 w-2 rounded-full bg-pink-500" />
                                  Magenta
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-8 text-xs"
                                  value={p.magentaToner ?? ""}
                                  onChange={(e) =>
                                    updatePrinter(p.id, {
                                      magentaToner: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0-100"
                                  required
                                />
                              </div>

                              {/* Cyan */}
                              <div className="p-2 border rounded-md bg-background space-y-1 border-sky-400/50">
                                <span className="text-[11px] font-semibold flex items-center gap-1 text-sky-600 dark:text-sky-400">
                                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                                  Cyan
                                </span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="h-8 text-xs"
                                  value={p.cyanToner ?? ""}
                                  onChange={(e) =>
                                    updatePrinter(p.id, {
                                      cyanToner: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0-100"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {p.status === "Not Working" && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <Label className="text-xs">Printer IP Address (Optional)</Label>
                          <Input
                            value={p.ip || ""}
                            onChange={(e) => updatePrinter(p.id, { ip: e.target.value })}
                            placeholder="e.g. 10.63.192.2"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Printer Problem / Issue</Label>
                          <Textarea
                            value={p.problem || ""}
                            onChange={(e) => updatePrinter(p.id, { problem: e.target.value })}
                            placeholder="Describe printer issue (e.g. paper jam, offline, cartridge error)"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addPrinter}
                  className="w-full border-dashed py-5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Add Another Printer at this Location
                </Button>
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

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={resetFormState}
          disabled={submitting}
          className="sm:w-36 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Clear Form
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!allValid || submitting}
          className="flex-1 h-11"
          style={allValid ? { background: "var(--gradient-primary)" } : undefined}
        >
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Checklist
        </Button>
      </div>
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
