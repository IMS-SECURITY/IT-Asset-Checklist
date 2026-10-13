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
1. Firebase Console → Authentication → Add user.
2. Firestore → `employees` → doc ID = that UID:
```json
{
  "employeeID": "EMP-001",
  "name": "Jane Doe",
  "email": "jane@company.com",
  "location": "Chennai",
  "role": "employee",
  "projectId": "<projectId>",
  "projectName": "Project Alpha",
  "branches": ["Main", "Annex"]
}
```
Employee logs in via the **Employee** tab with: **Employee ID + Location + Password**.

> Note: The spec called for "Location + Password" only, but multiple employees can share a location. The form adds Employee ID to uniquely identify the account; Location is still validated against the employee profile and login fails on mismatch.

## Collections
- `projects` — `{ name, createdAt }`
- `employees` — see structures above
- `checklists` — doc ID `{uid}_{YYYY-MM-DD}` (enforces one per employee per day)
