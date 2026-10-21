export type Role = "superadmin" | "admin" | "employee";

export interface UserProfile {
  uid: string;
  employeeID: string;
  name: string;
  email?: string;
  authEmail?: string;
  location: string;
  role: Role;
  projectId: string;
  projectName: string;
  adminProjects?: string[];
  branches?: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt?: any;
}

export type Status = "Working" | "Not Working" | "NA";
export type YesNo = "Yes" | "No";
export type PrinterType = "Monochrome" | "Colour";

export interface PrinterItem {
  id: string;
  status: Status;
  ip?: string;
  problem?: string;
  printerType?: PrinterType;
  blackToner?: number | null;
  cyanToner?: number | null;
  magentaToner?: number | null;
  yellowToner?: number | null;
}

export interface Checklist {
  id?: string;
  uid: string;
  employeeID: string;
  employeeName: string;
  projectId: string;
  projectName: string;
  branch: string;
  date: string; // yyyy-MM-dd
  wifi: Status;
  wifiProblem?: string;
  lan: Status;
  lanProblem?: string;
  printers?: PrinterItem[];
  printer: Status;
  printerIP?: string;
  printerProblem?: string;
  tonerAvailable: YesNo;
  tonerStatus?: number | null;
  vcon: Status;
  vconProblem?: string;
  submittedAt: any;
}
