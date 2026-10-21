# Branch IT Daily Checklist — Setup

Firebase project: `it-checklist-675b6`

## 1. Enable Firebase Auth
In the Firebase Console → Authentication → enable **Email/Password** provider.

## 2. Deploy Firestore security rules
Copy the contents of `firestore.rules` into Firebase Console → Firestore → Rules → Publish.

## 3. Super Admin & User Management
A Super Admin can create additional Super Admins, Project Admins, and Employees directly within the app, as well as edit any user's role and project assignments.

### Adding another Super Admin
Log in as Super Admin → `/super` → click **"New Super Admin"** → enter Full Name, Employee ID, Location, Email, and Initial Password.

### Editing User / Employee Roles
Log in as Super Admin → `/super` → in the **"Users & Role Management"** table, click the **Edit** (pencil) button on any user row. You can:
- Switch their role between **Super Admin**, **Project Admin**, and **Employee**
- Assign / change projects and admin project access
- Assign / update branch locations
- Update Full Name, Employee ID, and Location
- Send password reset emails or delete user accounts

## 4. Create Projects
Log in as Super Admin → `/super` → use the Projects panel.

## 5. Create a Project Admin
Can be created from `/super` via **"New Admin"** button, or via manual auth + Firestore creation:
```json
{
  "employeeID": "ADM-001",
  "name": "Admin Name",
  "email": "admin@example.com",
  "location": "Chennai",
  "role": "admin",
  "projectId": "",
  "projectName": "",
  "adminProjects": ["<projectId>"],
  "branches": []
}
```

## 6. Create an Employee
Employees can be created directly from the app by **Super Admin** or **Project Admin** (via `/admin/employees` or `/super` → "New Employee"):
- **No email required**: Employees do not need an email address.
- Enter: Full Name, Employee ID, Location, Project, Initial Password, and Branches.
- Employee logs in via the **Employee** tab with: **Employee Name + Password**.

### Password Reset for Employees
Since employees do not use emails, password reset links cannot be emailed to them. If an employee forgets their password:
- **Super Admin** or **Project Admin** opens the Super Admin panel (`/super`) or Employees page (`/admin/employees`).
- Click the **Key icon** (Force Change Password) on the employee's row.
- Enter the new password and click **"Set New Password"**.
- The employee can immediately sign in with their Name and this new password.

## Collections
- `projects` — `{ name, createdAt }`
- `employees` — see structures above
- `checklists` — doc ID `{uid}_{YYYY-MM-DD}` (enforces one per employee per day)
