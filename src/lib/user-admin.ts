import { initializeApp, deleteApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
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
  email?: string;
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
 * For employees, if email is omitted, an internal synthetic email is generated.
 */
export async function createAppUser(input: CreateUserInput): Promise<string> {
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);
  try {
    const rawEmail = input.email?.trim().toLowerCase();
    // For employees without an email address, generate an internal auth email
    const authEmail =
      rawEmail || `${nameKey(input.name)}_${Date.now()}@tvse-internal.local`;

    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      authEmail,
      input.password,
    );
    const uid = cred.user.uid;

    await setDoc(doc(db, "employees", uid), {
      employeeID: input.employeeID.trim(),
      name: input.name.trim(),
      email: rawEmail || "",
      authEmail,
      location: input.location.trim(),
      role: input.role,
      projectId: input.projectId,
      projectName: input.projectName,
      adminProjects: input.role === "admin" ? input.adminProjects ?? [] : [],
      branches: input.role === "employee" ? input.branches ?? [] : [],
      createdAt: serverTimestamp(),
    });

    // Public lookup so employees can sign in with their name (or Employee ID)
    if (input.role === "employee") {
      const loginPayload = {
        email: authEmail,
        uid,
        name: input.name.trim(),
      };
      const key = nameKey(input.name);
      if (key) {
        await setDoc(doc(db, "employeeLogins", key), loginPayload);
      }
      const idKey = nameKey(input.employeeID);
      if (idKey && idKey !== key) {
        await setDoc(doc(db, "employeeLogins", idKey), loginPayload);
      }
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

export interface ForceChangePasswordInput {
  uid: string;
  newPassword: string;
}

/**
 * Forcibly updates an employee's password without requiring an email reset link.
 * Used by Super Admin when an employee forgets their password.
 */
export async function forceChangeEmployeePassword(
  input: ForceChangePasswordInput,
): Promise<void> {
  if (!input.newPassword || input.newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const empRef = doc(db, "employees", input.uid);
  const empSnap = await getDoc(empRef);
  if (!empSnap.exists()) {
    throw new Error("Employee record not found in system");
  }
  const empData = empSnap.data() as any;

  const key = nameKey(empData.name || "employee");
  const newAuthEmail = `${key}_${Date.now()}@tvse-internal.local`;

  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    // 1. Create a fresh Firebase Auth user with the new password
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      newAuthEmail,
      input.newPassword,
    );
    const newUid = cred.user.uid;

    // 2. Clone employee profile under newUid
    await setDoc(doc(db, "employees", newUid), {
      ...empData,
      uid: newUid,
      authEmail: newAuthEmail,
      passwordUpdatedAt: serverTimestamp(),
    });

    // 3. Update public employeeLogins lookup
    const loginPayload = {
      email: newAuthEmail,
      uid: newUid,
      name: empData.name,
    };
    if (key) {
      await setDoc(doc(db, "employeeLogins", key), loginPayload);
    }
    const idKey = empData.employeeID ? nameKey(empData.employeeID) : "";
    if (idKey && idKey !== key) {
      await setDoc(doc(db, "employeeLogins", idKey), loginPayload);
    }

    // 4. Migrate existing checklist records so employee history is preserved
    try {
      const subSnap = await getDocs(
        query(collection(db, "checklists"), where("uid", "==", input.uid)),
      );
      for (const sDoc of subSnap.docs) {
        await updateDoc(sDoc.ref, { uid: newUid });
      }
    } catch (migErr) {
      console.warn("Notice: Checklist history UID migration warning:", migErr);
    }

    // 5. Delete old employee profile doc if UID changed
    if (newUid !== input.uid) {
      await deleteDoc(empRef).catch(() => {});
    }

    await fbSignOut(secondaryAuth);
  } finally {
    try {
      await deleteApp(secondary);
    } catch {
      /* ignore */
    }
  }
}

export interface UpdateUserRoleInput {
  uid: string;
  name: string;
  email?: string;
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
    email: input.email ? input.email.trim().toLowerCase() : "",
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

    // Ensure public lookup exists for employee login
    const empSnap = await getDoc(ref);
    const existingAuthEmail = empSnap.exists()
      ? (empSnap.data().authEmail || empSnap.data().email)
      : (input.email ? input.email.trim().toLowerCase() : "");

    const loginPayload = {
      email: existingAuthEmail || `${nameKey(input.name)}@tvse-internal.local`,
      uid: input.uid,
      name: input.name.trim(),
    };
    const key = nameKey(input.name);
    if (key) {
      await setDoc(doc(db, "employeeLogins", key), loginPayload, { merge: true });
    }
    const idKey = nameKey(input.employeeID);
    if (idKey && idKey !== key) {
      await setDoc(doc(db, "employeeLogins", idKey), loginPayload, { merge: true });
    }
  }

  await setDoc(ref, data, { merge: true });
}
