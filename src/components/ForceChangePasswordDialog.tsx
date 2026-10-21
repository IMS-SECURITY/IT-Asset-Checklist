import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { forceChangeEmployeePassword } from "@/lib/user-admin";

interface ForceChangePasswordDialogProps {
  user: {
    id: string;
    name: string;
    employeeID?: string;
    role?: string;
  };
  trigger?: React.ReactNode;
  onUpdated?: () => void;
}

export function ForceChangePasswordDialog({
  user,
  trigger,
  onUpdated,
}: ForceChangePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let rand = "";
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newPass = `Tvs#${rand}`;
    setPassword(newPass);
    setShowPass(true);
    toast.info(`Generated password: ${newPass}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setBusy(true);
    try {
      await forceChangeEmployeePassword({
        uid: user.id,
        newPassword: password,
      });
      toast.success(
        `Password updated for "${user.name}". They can now sign in with their Name and this new password.`,
      );
      setOpen(false);
      setPassword("");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setPassword("");
        setShowPass(false);
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            variant="ghost"
            title="Force change password"
            className="hover:text-amber-500"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <span>Change Password</span>
            </DialogTitle>
            <DialogDescription>
              Forcibly change password for <strong>{user.name}</strong>{" "}
              {user.employeeID ? `(${user.employeeID})` : ""}. No email confirmation is required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1 text-muted-foreground border">
              <p><strong>Employee:</strong> {user.name}</p>
              {user.employeeID && <p><strong>Employee ID:</strong> {user.employeeID}</p>}
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                The employee will immediately use this new password along with their Name to sign in.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-password">New Password</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generatePassword}
                  className="h-7 text-xs px-2 text-primary"
                >
                  <Sparkles className="h-3 w-3 mr-1" /> Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || password.length < 6}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {busy ? "Updating..." : "Set New Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
