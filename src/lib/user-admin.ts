import { initializeApp, deleteApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";
import type { Role } from "./types";

export const nameKey = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const SECONDARY_NAME = "user-admin-secondary";

function getSecondaryApp() {
  const existing = getApps().find((a) => a.name === SECONDARY_NAME);
  if (existing) return existing;
  const primary = getApp();
  return initializeApp(primary.options, SECONDARY_NAME);
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  employeeID: string;
  location: string;
  role: Role;
  projectId: string;
  projectName: string;
  adminProjects?: string[];
  branches?: string[];
}

/**
 * Creates a Firebase Auth user using a secondary app instance so the
 * currently signed-in admin/superadmin session is NOT affected, then
 * writes the matching profile doc in /employees/{uid}.
 */
export async function createAppUser(input: CreateUserInput): Promise<string> {
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);
  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim().toLowerCase(),
      input.password,
    );
    const uid = cred.user.uid;

    await setDoc(doc(db, "employees", uid), {
      employeeID: input.employeeID.trim(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      location: input.location.trim(),
      role: input.role,
      projectId: input.projectId,
      projectName: input.projectName,
      adminProjects: input.role === "admin" ? input.adminProjects ?? [] : [],
      branches: input.role === "employee" ? input.branches ?? [] : [],
      createdAt: serverTimestamp(),
    });

    // Public name -> email lookup so employees can sign in with just their name.
    if (input.role === "employee") {
      await setDoc(doc(db, "employeeLogins", nameKey(input.name)), {
        email: input.email.trim().toLowerCase(),
        uid,
        name: input.name.trim(),
      });
    }

    // sign the secondary app out so its session doesn't linger
    await fbSignOut(secondaryAuth);
    return uid;
  } finally {
    try {
      await deleteApp(secondary);
    } catch {
      /* ignore */
    }
  }
}

export async function sendResetEmail(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export interface UpdateUserRoleInput {
  uid: string;
  name: string;
  email: string;
  employeeID: string;
  location: string;
  role: Role;
  projectId?: string;
  projectName?: string;
  adminProjects?: string[];
  branches?: string[];
}

/**
 * Updates a user's role and associated profile metadata.
 * Ensures employeeLogins lookup is maintained if the user is an employee.
 */
export async function updateUserRole(input: UpdateUserRoleInput): Promise<void> {
  const ref = doc(db, "employees", input.uid);
  const data: any = {
    name: input.name.trim(),
    employeeID: input.employeeID.trim(),
    email: input.email.trim().toLowerCase(),
    location: input.location.trim(),
    role: input.role,
    updatedAt: serverTimestamp(),
  };

  if (input.role === "superadmin") {
    data.projectId = "";
    data.projectName = "";
    data.adminProjects = [];
    data.branches = [];
  } else if (input.role === "admin") {
    data.projectId = input.projectId || "";
    data.projectName = input.projectName || "";
    data.adminProjects = input.adminProjects ?? (input.projectId ? [input.projectId] : []);
    data.branches = [];
  } else if (input.role === "employee") {
    data.projectId = input.projectId || "";
    data.projectName = input.projectName || "";
    data.adminProjects = [];
    data.branches = input.branches ?? [];

    // Ensure public name lookup exists for employee login
    await setDoc(
      doc(db, "employeeLogins", nameKey(input.name)),
      {
        email: input.email.trim().toLowerCase(),
        uid: input.uid,
        name: input.name.trim(),
      },
      { merge: true },
    );
  }

  await setDoc(ref, data, { merge: true });
}
