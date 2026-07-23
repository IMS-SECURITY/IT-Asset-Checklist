import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-context";

interface ThemeToggleProps {
  showLabel?: boolean;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "ghost";
}

export function ThemeToggle({ showLabel = false, size = "sm", variant = "outline" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button variant={variant} size={size} type="button" onClick={toggleTheme} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel && <span>{isDark ? "Light" : "Dark"}</span>}
    </Button>
  );
}
