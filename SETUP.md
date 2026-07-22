# Branch IT Daily Checklist — Setup

Firebase project: `it-checklist-675b6`

## 1. Enable Firebase Auth
In the Firebase Console → Authentication → enable **Email/Password** provider.

## 2. Deploy Firestore security rules
Copy the contents of `firestore.rules` into Firebase Console → Firestore → Rules → Publish.

## 3. Create the Super Admin (one-time, manual)

### a. Create the Auth user
Firebase Console → Authentication → Add user
- Email: `puliker23@gmail.com`
- Password: (choose one)
- Copy the generated **UID**.

### b. Create the Firestore profile
Firestore → start collection `employees` → document ID = the UID from above:
```json
{
  "employeeID": "SUPER-001",
  "name": "Super Admin",
  "email": "puliker23@gmail.com",
  "location": "HQ",
  "role": "superadmin",
  "projectId": "",
  "projectName": "",
  "adminProjects": [],
  "branches": []
}
```
Now log in via the **Super** tab on `/login`.

## 4. Create Projects
Log in as Super Admin → `/super` → use the Projects panel.

## 5. Create a Project Admin
1. Firebase Console → Authentication → Add user (email + password).
2. Firestore → `employees` → doc ID = that UID:
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
3. Or from the Super Panel, enter the admin email and pick a project to assign.

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
