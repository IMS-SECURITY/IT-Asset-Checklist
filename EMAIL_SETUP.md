# Daily 11:00 AM Email — Free Setup (Brevo + GitHub Actions)

Uses **GitHub Actions cron** (free) + **Firebase Admin SDK** + **Brevo SMTP** (free, 300 emails/day). Runs every day at 11:00 Asia/Kolkata.

Files:
- `.github/workflows/daily-email.yml` — cron schedule (`30 5 * * *` UTC = 11:00 IST) and manual trigger.
- `scripts/send-daily-summary.mjs` — reads Firestore and sends one email per project to its admins + all super admins + extra recipients set in the Super Admin panel.
- `scripts/package.json` — deps (`firebase-admin`, `nodemailer`).

## One-time setup

### 1. Firebase service account
Firebase Console → Project Settings → **Service accounts** → **Generate new private key** → open the downloaded JSON and copy its entire contents.

### 2. Brevo account + verified sender
1. Sign up at https://www.brevo.com (free plan = 300 emails/day).
2. **Senders & IP** → **Senders** → add the address you want the emails to come from (e.g. `it@yourdomain.com` or a personal email) and click the verification link Brevo emails you.
3. **SMTP & API** → **SMTP** tab → copy the **Login** (usually your Brevo account email) and the **SMTP key** (looks like `xsmtpsib-...`). Generate one if none exists.

### 3. Add GitHub repo secrets
Repo → Settings → Secrets and variables → Actions → **New repository secret**. Add:

| Secret name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON from step 1 |
| `BREVO_SMTP_USER` | Brevo SMTP **Login** from step 2 |
| `BREVO_SMTP_KEY` | Brevo SMTP **key** from step 2 |
| `MAIL_FROM` | Verified sender, e.g. `IT Team <it@yourdomain.com>` |

`MAIL_FROM` must match a verified sender in Brevo, otherwise sends will fail.

### 4. Publish updated Firestore rules
Copy `firestore.rules` into Firebase Console → Firestore → Rules → Publish. This adds the `emailRecipients` collection used for extra recipients.

### 5. Test it
GitHub → **Actions** tab → **Daily IT Checklist Summary** → **Run workflow**. Check the run logs and your inbox.

## Recipients
Each project's email goes to the union of:
- **Project admins** — every admin whose `adminProjects` contains the project.
- **Super admins** — every user with `role: superadmin`.
- **Extra recipients** — addresses added in **Super Admin → Daily Email Recipients**. Leave project blank to receive mail for all projects, or pick one to scope it.

Duplicates are removed automatically.

## Email content
Per project, per day:
- Filled Locations Count / Not Filled Locations Count
- Two side-by-side lists: Filled Branches / Not Filled Branches
- Dashboard Details table: Branch, Employee, WiFi, LAN, Printer, Toner, VCON

## Free-tier limits
- **GitHub Actions**: 2,000 min/month free (unlimited on public repos); this job runs ~30s.
- **Brevo**: 300 emails/day on the free plan — plenty for admin summaries.
