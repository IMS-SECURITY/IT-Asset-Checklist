import type { PrinterItem, Status } from "./types";

/**
 * Formats toner percentages for a single printer.
 * For Monochrome: "Black 30%"
 * For Colour: "Black 60%, Yellow 10%, Magenta 20%, Cyan 90%"
 */
export function formatSinglePrinterToner(p: PrinterItem): string {
  if (p.status === "NA") return "NA";
  if (p.status === "Not Working") return `Not Working${p.problem ? ` (${p.problem})` : ""}`;

  if (p.printerType === "Colour") {
    const parts: string[] = [];
    if (p.blackToner !== null && p.blackToner !== undefined) parts.push(`Black ${p.blackToner}%`);
    if (p.yellowToner !== null && p.yellowToner !== undefined) parts.push(`Yellow ${p.yellowToner}%`);
    if (p.magentaToner !== null && p.magentaToner !== undefined) parts.push(`Magenta ${p.magentaToner}%`);
    if (p.cyanToner !== null && p.cyanToner !== undefined) parts.push(`Cyan ${p.cyanToner}%`);
    return parts.join(", ") || "No toner data";
  }

  // Monochrome
  return p.blackToner !== null && p.blackToner !== undefined ? `Black ${p.blackToner}%` : "No toner data";
}

/**
 * Formats multiple printers and their toners into a clean multi-line or delimited text.
 * Matches the format shown in the user's checklist table.
 */
export function formatPrintersSummary(
  printers?: PrinterItem[],
  legacy?: {
    printer?: string;
    printerIP?: string;
    tonerAvailable?: string;
    tonerStatus?: number | null;
  },
  delimiter: string = " | ",
): string {
  if (printers && printers.length > 0) {
    return printers
      .map((p, idx) => {
        const ipLabel = p.ip ? p.ip.trim() : `Printer ${idx + 1}`;
        if (p.status === "NA") return `${ipLabel}: NA`;
        if (p.status === "Not Working") return `${ipLabel}: Not Working (${p.problem || "Issue"})`;
        return `${ipLabel}: ${formatSinglePrinterToner(p)}`;
      })
      .join(delimiter);
  }

  // Fallback for legacy checklist submissions
  if (legacy) {
    const ip = legacy.printerIP ? `${legacy.printerIP}: ` : "";
    if (legacy.tonerAvailable === "Yes" && legacy.tonerStatus !== null && legacy.tonerStatus !== undefined) {
      return `${ip}Black ${legacy.tonerStatus}%`;
    }
    if (legacy.printer === "NA") return "NA";
    if (legacy.tonerAvailable === "No") return `${ip}No Toner`;
    return legacy.printer || "-";
  }

  return "-";
}

/**
 * Derives overall printer status from an array of printers.
 * If any printer is "Not Working", overall status is "Not Working".
 * Else if any printer is "Working", overall status is "Working".
 * Else "NA".
 */
export function computeOverallPrinterStatus(printers: PrinterItem[]): Status {
  if (!printers || printers.length === 0) return "NA";
  if (printers.some((p) => p.status === "Not Working")) return "Not Working";
  if (printers.some((p) => p.status === "Working")) return "Working";
  return "NA";
}
