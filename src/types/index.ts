// AtlasPM - Shared TypeScript Types

export type UserRole = "ADMIN" | "PM" | "COLLECTOR" | "OWNER" | "BROKER";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedProperties: string[] | null;
}

export type ArrearsCategory = "current" | "30" | "60" | "90" | "120+" | "vacant";
export type LeaseStatus = "active" | "expiring-soon" | "expired" | "no-lease" | "vacant";
export type NoteCategory = "general" | "collection" | "payment" | "legal" | "lease" | "maintenance";
export type CommType = "phone" | "email" | "letter" | "in-person" | "text-msg" | "legal-notice" | "other";

export type LegalStage =
  | "notice-sent" | "holdover" | "nonpayment" | "court-date"
  | "stipulation" | "judgment" | "warrant" | "eviction" | "settled";

export interface TenantView {
  id: string;
  unitId: string;
  yardiResidentId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  unitNumber: string;
  unitType: string | null;
  buildingId: string;
  buildingAddress: string;
  buildingRegion: string | null;
  entity: string | null;
  portfolio: string | null;
  marketRent: number;
  legalRent: number;
  dhcrLegalRent: number;
  prefRent: number;
  actualRent: number;
  chargeCode: string | null;
  isStabilized: boolean;
  deposit: number;
  moveInDate: string | null;
  leaseExpiration: string | null;
  moveOutDate: string | null;
  balance: number;
  arrearsCategory: ArrearsCategory;
  arrearsDays: number;
  monthsOwed: number;
  leaseStatus: LeaseStatus;
  collectionScore: number;
  legalFlag: boolean;
  legalStage: LegalStage | null;
  legalRecommended: boolean;
  noteCount: number;
  paymentCount: number;
  taskCount: number;
}

export interface ContactJson {
  name?: string;
  phone?: string;
  email?: string;
}

export interface CompanyJson {
  name?: string;
  phone?: string;
  contract?: string;
}

export interface UtilityJson {
  gas?: string;
  electric?: string;
  water?: string;
}

export interface BuildingView {
  id: string;
  yardiId: string;
  address: string;
  altAddress: string | null;
  entity: string | null;
  portfolio: string | null;
  region: string | null;
  zip: string | null;
  block: string | null;
  lot: string | null;
  type: string;
  owner: string | null;
  manager: string | null;
  arTeam: string | null;
  apTeam: string | null;
  headPortfolio: string | null;
  mgmtStartDate: string | null;
  einNumber: string | null;
  superintendent: ContactJson | null;
  elevatorCompany: CompanyJson | null;
  fireAlarmCompany: CompanyJson | null;
  utilityMeters: UtilityJson | null;
  utilityAccounts: UtilityJson | null;
  totalUnits: number;
  occupied: number;
  vacant: number;
  totalMarketRent: number;
  totalBalance: number;
  legalCaseCount: number;
}

export interface PortfolioMetrics {
  totalUnits: number;
  occupied: number;
  vacant: number;
  totalMarketRent: number;
  totalBalance: number;
  occupancyRate: number;
  lostRent: number;
  arrears30: number;
  arrears60: number;
  arrears90Plus: number;
  legalCaseCount: number;
  noLease: number;
  expiredLease: number;
  expiringSoon: number;
}

export const ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  ADMIN:     { allProps: true, dash: true, notes: true, pay: true, legal: true, upload: true, users: true, vac: true, lease: true, fin: true, reports: true, edit: true, email: true, maintenance: true },
  PM:        { allProps: false, dash: true, notes: true, pay: true, legal: true, upload: true, users: false, vac: true, lease: true, fin: true, reports: true, edit: true, email: true, maintenance: true },
  COLLECTOR: { allProps: false, dash: true, notes: true, pay: true, legal: false, upload: false, users: false, vac: false, lease: false, fin: true, reports: true, edit: true, email: true, maintenance: true },
  OWNER:     { allProps: false, dash: true, notes: false, pay: false, legal: false, upload: false, users: false, vac: true, lease: true, fin: true, reports: true, edit: false, email: false, maintenance: false },
  BROKER:    { allProps: false, dash: true, notes: false, pay: false, legal: false, upload: false, users: false, vac: true, lease: true, fin: false, reports: false, edit: false, email: false, maintenance: false },
};

export function hasPermission(role: UserRole, perm: string): boolean {
  return ROLE_PERMISSIONS[role]?.[perm] ?? false;
}

// ── Work Order Types ─────────────────────────────────────────────

export type WorkOrderStatus = "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED";
export type WorkOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type WorkOrderCategory = "PLUMBING" | "ELECTRICAL" | "HVAC" | "APPLIANCE" | "GENERAL" | "OTHER";

export interface WorkOrderView {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  photos: string[] | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledDate: string | null;
  completedDate: string | null;
  buildingId: string;
  buildingAddress: string;
  unitId: string | null;
  unitNumber: string | null;
  tenantId: string | null;
  tenantName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdById: string | null;
  createdByName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorView {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  hourlyRate: number | null;
  notes: string | null;
}