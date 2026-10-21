/**
 * Daily IT Checklist Summary — Brevo SMTP edition.
 *
 * Runs from GitHub Actions cron (see .github/workflows/daily-email.yml).
 * For each project it builds a Filled / Not Filled branch table for
 * today (Asia/Kolkata) and emails every admin of that project + every
 * super admin + every extra recipient configured in Firestore
 * (`emailRecipients` collection, editable from the Super Admin panel).
 *
 * Required env vars (set as GitHub Actions secrets):
 *   FIREBASE_SERVICE_ACCOUNT   full JSON of a service account key
 *   BREVO_SMTP_USER            Brevo SMTP login (Brevo → SMTP & API → SMTP)
 *   BREVO_SMTP_KEY             Brevo SMTP master password / key
 *   MAIL_FROM                  verified sender, e.g. "IT Team <it@yourdomain.com>"
 */

import admin from "firebase-admin";
import nodemailer from "nodemailer";

const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!svcJson) throw new Error("FIREBASE_SERVICE_ACCOUNT is required");
const BREVO_SMTP_USER = process.env.BREVO_SMTP_USER;
const BREVO_SMTP_KEY = process.env.BREVO_SMTP_KEY;
if (!BREVO_SMTP_USER || !BREVO_SMTP_KEY) {
  throw new Error("BREVO_SMTP_USER and BREVO_SMTP_KEY are required");
}
const MAIL_FROM = process.env.MAIL_FROM;
if (!MAIL_FROM) throw new Error("MAIL_FROM is required (must be a verified Brevo sender)");

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svcJson)) });
const db = admin.firestore();

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_KEY },
});

function todayKeyIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function statusBadge(v) {
  const color =
    v === "Working" || v === "Yes"
      ? "background:#d1fae5;color:#065f46;"
      : v === "Not Working" || v === "No"
      ? "background:#fee2e2;color:#991b1b;"
      : "background:#e5e7eb;color:#374151;";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;${color}">${v}</span>`;
}

function renderTonerCell(s) {
  if (s.printers && s.printers.length > 0) {
    return s.printers
      .map((p, idx) => {
        const ip = p.ip ? `<b>${p.ip}</b>` : `Printer #${idx + 1}`;
        if (p.status !== "Working") {
          return `<div style="margin-bottom:2px;">${ip}: <span style="color:#991b1b;">${p.status}</span></div>`;
        }
        if (p.printerType === "Colour") {
          return `<div style="margin-bottom:2px;">${ip}: <span style="font-size:11px;">K:${p.blackToner ?? 0}% Y:${p.yellowToner ?? 0}% M:${p.magentaToner ?? 0}% C:${p.cyanToner ?? 0}%</span></div>`;
        }
        return `<div style="margin-bottom:2px;">${ip}: Black ${p.blackToner ?? 0}%</div>`;
      })
      .join("");
  }
  return s.tonerAvailable === "Yes" ? `Yes · ${s.tonerStatus ?? "-"}%` : "No";
}

function renderHtml({ projectName, dateStr, filled, notFilled, submissions }) {
  const row = (v) =>
    `<tr><td style="padding:8px 12px;border-top:1px solid #e5e7eb;">${v}</td></tr>`;
  const filledRows = filled.length
    ? filled.map(row).join("")
    : `<tr><td style="padding:12px;color:#6b7280;">None</td></tr>`;
  const notFilledRows = notFilled.length
    ? notFilled.map(row).join("")
    : `<tr><td style="padding:12px;color:#6b7280;">None 🎉</td></tr>`;

  const subRows = submissions.length
    ? submissions
        .map(
          (s) => `
        <tr>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${s.branch || ""}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${s.employeeName || ""}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${statusBadge(s.wifi)}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${statusBadge(s.lan)}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${statusBadge(s.manageEngineDS)}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">
            ${statusBadge(s.printer)}
            ${s.printers && s.printers.length > 1 ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${s.printers.length} Printers</div>` : ""}
          </td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;font-size:12px;">${renderTonerCell(s)}</td>
          <td style="padding:8px 10px;border-top:1px solid #e5e7eb;">${statusBadge(s.vcon)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="8" style="padding:12px;color:#6b7280;">No submissions yet.</td></tr>`;

  return `
  <div style="font-family:Arial,sans-serif;color:#111827;max-width:820px;margin:0 auto;">
    <p>Hello Team,</p>
    <h2 style="margin:8px 0;">Daily IT Checklist Summary</h2>
    <p style="margin:4px 0;"><b>Project:</b> ${projectName}</p>
    <p style="margin:4px 0;"><b>Date:</b> ${dateStr}</p>

    <h3 style="margin-top:16px;">Submission Summary</h3>
    <p style="margin:4px 0;">Filled Locations Count : <b>${filled.length}</b></p>
    <p style="margin:4px 0;">Not Filled Locations Count : <b>${notFilled.length}</b></p>

    <h3 style="margin-top:16px;">Location Summary</h3>
    <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
      <tr style="vertical-align:top;">
        <td style="width:50%;padding-right:8px;">
          <table style="width:100%;border:1px solid #86efac;border-radius:6px;background:#ecfdf5;">
            <thead><tr><th style="text-align:left;padding:10px 12px;background:#d1fae5;border-bottom:1px solid #86efac;">Filled Branches</th></tr></thead>
            <tbody>${filledRows}</tbody>
          </table>
        </td>
        <td style="width:50%;padding-left:8px;">
          <table style="width:100%;border:1px solid #fcd34d;border-radius:6px;background:#fffbeb;">
            <thead><tr><th style="text-align:left;padding:10px 12px;background:#fde68a;border-bottom:1px solid #fcd34d;">Not Filled Branches</th></tr></thead>
            <tbody>${notFilledRows}</tbody>
          </table>
        </td>
      </tr>
    </table>

    <h3 style="margin-top:24px;">Dashboard Details</h3>
    <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:10px;">Branch</th>
          <th style="text-align:left;padding:10px;">Employee</th>
          <th style="text-align:left;padding:10px;">WiFi</th>
          <th style="text-align:left;padding:10px;">LAN</th>
          <th style="text-align:left;padding:10px;">Manage Engine DS</th>
          <th style="text-align:left;padding:10px;">Printer</th>
          <th style="text-align:left;padding:10px;">Toner</th>
          <th style="text-align:left;padding:10px;">VCON</th>
        </tr>
      </thead>
      <tbody>${subRows}</tbody>
    </table>

    <p style="margin-top:24px;">Regards,<br/>IT Team</p>
  </div>`;
}

async function run() {
  const dateStr = todayKeyIST();

  const [projSnap, empSnap, subSnap, extraSnap] = await Promise.all([
    db.collection("projects").get(),
    db.collection("employees").get(),
    db.collection("checklists").where("date", "==", dateStr).get(),
    db.collection("emailRecipients").get(),
  ]);

  const employees = empSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const submissions = subSnap.docs.map((d) => d.data());

  // Extra recipients set by super admin.
  // Docs may have `email` and optional `projectId` (empty = all projects).
  const extras = extraSnap.docs.map((d) => d.data()).filter((x) => x && x.email);

  for (const p of projSnap.docs) {
    const project = { id: p.id, ...p.data() };

    // Per-project switch — super admin can disable daily mail per project.
    // Default: enabled (undefined/true). Only false disables it.
    if (project.emailEnabled === false) {
      console.log(`skip ${project.name}: emailEnabled=false`);
      continue;
    }

    const branchSet = new Set();
    employees
      .filter((e) => e.role === "employee" && e.projectId === project.id)
      .forEach((e) => (e.branches || []).forEach((b) => branchSet.add(b)));

    const projSubs = submissions.filter((s) => s.projectId === project.id);
    const filledSet = new Set(projSubs.map((s) => s.branch));

    const filled = [...filledSet].filter(Boolean).sort();
    const notFilled = [...branchSet].filter((b) => !filledSet.has(b)).sort();

    // Recipients = ONLY the emails configured by super admin in the
    // Daily Email Recipients panel (global or scoped to this project).
    const extraEmails = extras
      .filter((x) => !x.projectId || x.projectId === project.id)
      .map((x) => x.email);

    const recipients = [
      ...new Set(
        extraEmails.map((e) => e.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (recipients.length === 0) {
      console.log(`skip ${project.name}: no recipients configured`);
      continue;
    }


    const html = renderHtml({
      projectName: project.name,
      dateStr,
      filled,
      notFilled,
      submissions: projSubs.sort((a, b) => (a.branch || "").localeCompare(b.branch || "")),
    });

    await transporter.sendMail({
      from: MAIL_FROM,
      to: recipients.join(", "),
      subject: `Daily IT Checklist Summary — ${project.name} — ${dateStr}`,
      html,
    });
    console.log(
      `sent ${project.name} → ${recipients.length} recipient(s) (filled=${filled.length}, notFilled=${notFilled.length})`,
    );
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
