import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Save } from "lucide-react";
import { toast } from "sonner";

const WORKFLOW_FILE = "daily-email.yml";
const REF = "main";

export function SendNowSection() {
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "appConfig", "github"));
      if (snap.exists()) {
        const d = snap.data() as any;
        setRepo(d.repo || "");
        setHasToken(!!d.token);
      }
    })();
  }, []);

  const save = async () => {
    if (!repo.includes("/")) { toast.error("Repo must be like owner/name"); return; }
    setBusy(true);
    try {
      const payload: any = { repo: repo.trim() };
      if (token.trim()) payload.token = token.trim();
      await setDoc(doc(db, "appConfig", "github"), payload, { merge: true });
      toast.success("Saved");
      setToken("");
      setHasToken(true);
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const sendNow = async () => {
    const snap = await getDoc(doc(db, "appConfig", "github"));
    if (!snap.exists()) { toast.error("Save repo + token first"); return; }
    const { repo: r, token: t } = snap.data() as any;
    if (!r || !t) { toast.error("Repo and token required"); return; }
    if (!confirm("Trigger the daily summary email now?")) return;
    setSending(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${r}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${t}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({ ref: REF }),
        },
      );
      if (res.status === 204) {
        toast.success("Workflow triggered — check Actions tab / your inbox in ~30s");
      } else {
        const txt = await res.text();
        toast.error(`GitHub ${res.status}: ${txt.slice(0, 200)}`);
      }
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" /> Send Daily Email Now
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Manually triggers the GitHub Actions workflow that sends today's summary to configured recipients.
          Respects each project's Daily Email toggle.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>GitHub Repo (owner/name)</Label>
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="myorg/it-checklist" />
          </div>
          <div>
            <Label>GitHub Personal Access Token</Label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={hasToken ? "•••••••• (saved — leave blank to keep)" : "ghp_… or fine-grained token"}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <b>How to get the token:</b> GitHub → Settings → Developer settings →
            <b> Fine-grained tokens</b> → Generate new token. Grant access to just this repo, with
            <b> Repository permissions → Actions: Read and write</b>. Copy and paste above, then Save.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy} variant="secondary">
            <Save className="h-4 w-4 mr-1" />{busy ? "Saving..." : "Save"}
          </Button>
          <Button onClick={sendNow} disabled={sending || !repo || (!token && !hasToken)}>
            <Send className="h-4 w-4 mr-1" />{sending ? "Triggering..." : "Send Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
