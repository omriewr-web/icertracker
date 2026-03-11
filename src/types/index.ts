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

export interface LifeSafetyJson {
  sprinkler?: string;
  sprinklerCoverage?: string;
  fireAlarm?: string;
  egress?: string;
  backflow?: string;
  standpipe?: string;
  coolingTower?: string;
  waterStorageTank?: string;
  petroleumBulkStorage?: string;
}

export interface ElevatorInfoJson {
  type?: string;
  cat1Date?: string;
  cat5Date?: string;
  followUpNotes?: string;
  aocSubmitted?: string;
}

export interface BoilerInfoJson {
  lastInspectionDate?: string;
  device?: string;
  followUpNotes?: string;
}

export interface ComplianceDatesJson {
  ll152GasPipe?: string;
  parapetInspection?: string;
  hpdRegistrationYear?: string;
  bedBugFilingYear?: string;
  safetyFilingYear?: string;
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
  ownerEmail: string | null;
  manager: string | null;
  arTeam: string | null;
  apTeam: string | null;
  headPortfolio: string | null;
  mgmtStartDate: string | null;
  einNumber: string | null;
  bin: string | null;
  mdrNumber: string | null;
  dhcrRegId: string | null;
  squareFootage: number | null;
  yearBuilt: number | null;
  constructionType: string | null;
  floors: number | null;
  floorsBelowGround: number | null;
  lifeSafety: LifeSafetyJson | null;
  elevatorInfo: ElevatorInfoJson | null;
  boilerInfo: BoilerInfoJson | null;
  complianceDates: ComplianceDatesJson | null;
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
  legalBalance: number;
  nonLegalBalance: number;
  arrearsCount: number;
  legalCount: number;
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
  arrears30$: number;
  arrears60$: number;
  arrears90Plus$: number;
  current$: number;
  legalCaseCount: number;
  noLease: number;
  expiredLease: number;
  expiringSoon: number;
}

export const ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
  ADMIN:     { allProps: true, dash: true, notes: true, pay: true, legal: true, upload: true, users: true, vac: true, lease: true, fin: true, reports: true, edit: true, email: true, maintenance: true, compliance: true, collections: true, utilities: true },
  PM:        { allProps: false, dash: true, notes: true, pay: true, legal: true, upload: true, users: false, vac: true, lease: true, fin: true, reports: true, edit: true, email: true, maintenance: true, compliance: true, collections: true, utilities: true },
  COLLECTOR: { allProps: false, dash: true, notes: true, pay: true, legal: false, upload: false, users: false, vac: false, lease: false, fin: true, reports: true, edit: true, email: true, maintenance: true, compliance: true, collections: true, utilities: true },
  OWNER:     { allProps: false, dash: true, notes: false, pay: false, legal: false, upload: false, users: false, vac: true, lease: true, fin: true, reports: true, edit: false, email: false, maintenance: false, compliance: false, collections: false, utilities: false },
  BROKER:    { allProps: false, dash: true, notes: false, pay: false, legal: false, upload: false, users: false, vac: true, lease: true, fin: false, reports: false, edit: false, email: false, maintenance: false, compliance: false, collections: false, utilities: false },
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

// ── Compliance & Violation Types ────────────────────────────────

export type ViolationSource = "HPD" | "DOB" | "ECB" | "FDNY" | "DSNY" | "DOHMH" | "DOB_COMPLAINTS" | "HPD_COMPLAINTS" | "HPD_LITIGATION";
export type ViolationClass = "A" | "B" | "C" | "I" | "CLASS1" | "CLASS2" | "CLASS3";
export type ViolationSeverity = "IMMEDIATELY_HAZARDOUS" | "HAZARDOUS" | "NON_HAZARDOUS" | "INFO";
export type ComplianceCategory = "LOCAL_LAW" | "INSPECTION" | "FILING" | "CUSTOM";
export type ComplianceFrequency = "ANNUAL" | "SEMI_ANNUAL" | "QUARTERLY" | "FIVE_YEAR" | "FOUR_YEAR" | "ONE_TIME" | "ON_EVENT";
export type ComplianceStatus = "COMPLIANT" | "NON_COMPLIANT" | "PENDING" | "OVERDUE" | "SCHEDULED" | "NOT_APPLICABLE";

export interface ViolationView {
  id: string;
  buildingId: string;
  buildingAddress: string;
  source: ViolationSource;
  externalId: string;
  class: ViolationClass | null;
  severity: ViolationSeverity | null;
  description: string;
  inspectionDate: string | null;
  issuedDate: string | null;
  currentStatus: string | null;
  penaltyAmount: number;
  respondByDate: string | null;
  certifiedDismissDate: string | null;
  correctionDate: string | null;
  unitNumber: string | null;
  novDescription: string | null;
  hearingDate: string | null;
  hearingStatus: string | null;
  linkedWorkOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  daysUntilCure: number | null;
}

export interface ComplianceItemView {
  id: string;
  buildingId: string;
  buildingAddress: string;
  type: string;
  category: ComplianceCategory;
  name: string;
  description: string;
  dueDate: string | null;
  frequency: ComplianceFrequency;
  status: ComplianceStatus;
  lastCompletedDate: string | null;
  nextDueDate: string | null;
  assignedVendorId: string | null;
  assignedVendorName: string | null;
  cost: number;
  filedBy: string | null;
  certificateUrl: string | null;
  notes: string | null;
  linkedViolationId: string | null;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  daysUntilDue: number | null;
}

export interface ViolationStats {
  totalOpen: number;
  classACount: number;
  classBCount: number;
  classCCount: number;
  totalPenalties: number;
  upcomingHearings: number;
}

export interface ComplianceStats {
  total: number;
  compliant: number;
  nonCompliant: number;
  overdue: number;
  pending: number;
  upcomingThisMonth: number;
}

export interface BuildingScorecard {
  buildingId: string;
  address: string;
  classACount: number;
  classBCount: number;
  classCCount: number;
  pendingFines: number;
  complianceRate: number;
  overdueItems: number;
  healthScore: number;
  healthLabel: string;
}