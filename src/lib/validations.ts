import { z } from "zod";

export const tenantUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  marketRent: z.number().min(0).optional(),
  legalRent: z.number().min(0).optional(),
  chargeCode: z.string().nullable().optional(),
  deposit: z.number().min(0).optional(),
  balance: z.number().optional(),
  leaseExpiration: z.string().nullable().optional(),
  moveInDate: z.string().nullable().optional(),
  moveOutDate: z.string().nullable().optional(),
  isStabilized: z.boolean().optional(),
});

export const noteCreateSchema = z.object({
  text: z.string().min(1, "Note text is required"),
  category: z.enum(["GENERAL", "COLLECTION", "PAYMENT", "LEGAL", "LEASE", "MAINTENANCE"]).default("GENERAL"),
});

export const paymentCreateSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  method: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const legalCaseSchema = z.object({
  inLegal: z.boolean().optional(),
  stage: z.enum([
    "NOTICE_SENT", "HOLDOVER", "NONPAYMENT", "COURT_DATE",
    "STIPULATION", "JUDGMENT", "WARRANT", "EVICTION", "SETTLED",
  ]).optional(),
  caseNumber: z.string().nullable().optional(),
  attorney: z.string().nullable().optional(),
  attorneyId: z.string().nullable().optional(),
  filedDate: z.string().nullable().optional(),
  courtDate: z.string().nullable().optional(),
  arrearsBalance: z.number().min(0).nullable().optional(),
  status: z.enum(["active", "settled", "dismissed", "withdrawn"]).optional(),
  assignedUserId: z.string().nullable().optional(),
  marshalId: z.string().nullable().optional(),
  marshalScheduledDate: z.string().nullable().optional(),
  marshalExecutedDate: z.string().nullable().optional(),
});

export const legalNoteSchema = z.object({
  text: z.string().min(1),
  stage: z.enum([
    "NOTICE_SENT", "HOLDOVER", "NONPAYMENT", "COURT_DATE",
    "STIPULATION", "JUDGMENT", "WARRANT", "EVICTION", "SETTLED",
  ]),
});

const contactJsonSchema = z.object({
  name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
}).nullable().optional();

const companyJsonSchema = z.object({
  name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  contract: z.string().optional().default(""),
}).nullable().optional();

const utilityJsonSchema = z.object({
  gas: z.string().optional().default(""),
  electric: z.string().optional().default(""),
  water: z.string().optional().default(""),
}).nullable().optional();

export const buildingCreateSchema = z.object({
  yardiId: z.string().min(1),
  address: z.string().min(1),
  altAddress: z.string().nullable().optional(),
  entity: z.string().nullable().optional(),
  portfolio: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  block: z.string().nullable().optional(),
  lot: z.string().nullable().optional(),
  type: z.string().default("Residential"),
  owner: z.string().nullable().optional(),
  manager: z.string().nullable().optional(),
  arTeam: z.string().nullable().optional(),
  apTeam: z.string().nullable().optional(),
  headPortfolio: z.string().nullable().optional(),
  mgmtStartDate: z.string().nullable().optional(),
  einNumber: z.string().nullable().optional(),
  superintendent: contactJsonSchema,
  elevatorCompany: companyJsonSchema,
  fireAlarmCompany: companyJsonSchema,
  utilityMeters: utilityJsonSchema,
  utilityAccounts: utilityJsonSchema,
  totalUnits: z.number().int().min(0).default(0),
});

export const buildingUpdateSchema = buildingCreateSchema.partial();

const allRoles = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM", "APM", "COLLECTOR", "OWNER", "LEASING_SPECIALIST", "BROKER", "SUPER", "ACCOUNTING", "LEASING_AGENT"] as const;

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(allRoles).default("COLLECTOR"),
  managerId: z.string().nullable().optional(),
  buildingIds: z.array(z.string()).optional(),
});

export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(allRoles).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
  managerId: z.string().nullable().optional(),
  buildingIds: z.array(z.string()).optional(),
});

export const workOrderCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "ON_HOLD", "COMPLETED"]).default("OPEN"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  category: z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"]).default("GENERAL"),
  photos: z.array(z.string()).nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  actualCost: z.number().min(0).nullable().optional(),
  scheduledDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  sourceType: z.string().nullable().optional(),
  sourceId: z.string().nullable().optional(),
});

export const workOrderUpdateSchema = workOrderCreateSchema.partial();

export const workOrderCommentSchema = z.object({
  text: z.string().min(1),
  photos: z.array(z.string()).nullable().optional(),
});

export const vendorCreateSchema = z.object({
  name: z.string().min(1),
  company: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const vendorUpdateSchema = vendorCreateSchema.partial();

export const maintenanceScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"]),
  nextDueDate: z.string().min(1),
  autoCreateWorkOrder: z.boolean().default(true),
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
});

export const tenantRequestSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "GENERAL", "OTHER"]).default("GENERAL"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  tenantName: z.string().min(1, "Name is required"),
  tenantContact: z.string().min(1, "Contact info is required"),
  photos: z.array(z.string()).nullable().optional(),
  token: z.string().min(1, "Building token is required"),
});

export const emailSendSchema = z.object({
  tenantId: z.string().optional(),
  templateId: z.string().optional(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  type: z.enum(["DEMAND_LETTER", "PAYMENT_REMINDER", "LATE_NOTICE", "COLLECTION_REPORT", "LEASE_RENEWAL", "CUSTOM"]).default("CUSTOM"),
});

export const tenantCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitNumber: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  marketRent: z.number().min(0).optional().default(0),
  legalRent: z.number().min(0).optional().default(0),
  deposit: z.number().min(0).optional().default(0),
  chargeCode: z.string().nullable().optional(),
  isStabilized: z.boolean().optional().default(false),
  leaseExpiration: z.string().nullable().optional(),
  moveInDate: z.string().nullable().optional(),
});

export const noteUpdateSchema = z.object({
  text: z.string().min(1, "Note text is required"),
  category: z.enum(["GENERAL", "COLLECTION", "PAYMENT", "LEGAL", "LEASE", "MAINTENANCE"]).optional(),
});

// ── Import Validation Schemas ───────────────────────────────────

export const parsedTenantRowSchema = z.object({
  property: z.string().max(500).default(""),
  unit: z.string().min(1, "Unit is required").max(50),
  unitType: z.string().max(100).optional(),
  residentId: z.string().max(100).optional(),
  name: z.string().min(1, "Name is required").max(200),
  marketRent: z.number().min(0).max(1_000_000).default(0),
  chargeCode: z.string().max(50).optional(),
  chargeAmount: z.number().min(-1_000_000).max(1_000_000).default(0),
  deposit: z.number().min(0).max(1_000_000).default(0),
  balance: z.number().min(-10_000_000).max(10_000_000).default(0),
  moveIn: z.string().max(20).optional(),
  leaseExpiration: z.string().max(20).optional(),
  moveOut: z.string().max(20).optional(),
  isVacant: z.boolean().default(false),
});

export const parsedBuildingRowSchema = z.object({
  rowIndex: z.number(),

  // Identity
  buildingId: z.string().min(1).max(50),
  buildingName: z.string().max(200).optional(),

  // Location
  address: z.string().min(1).max(500),
  city: z.string().max(50).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().regex(/^\d{5}$/, "Must be 5-digit zip code"),
  borough: z.string().min(1).max(20),
  block: z.string().max(10).optional(),
  lot: z.string().max(10).optional(),
  bbl: z.string().max(10).optional(),
  bin: z.string().max(10).optional(),
  hpdRegistrationId: z.string().max(20).optional(),
  certificateOfOccupancy: z.string().max(20).optional(),
  portfolio: z.string().max(200).optional(),

  // Structure
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  floors: z.number().int().min(0).max(200).optional(),
  units: z.number().int().min(0).max(5000),
  commercialUnits: z.number().int().min(0).max(500).optional(),
  totalSquareFootage: z.number().int().min(0).max(10_000_000).optional(),
  buildingClass: z.string().max(10).optional(),
  constructionType: z.string().max(50).optional(),

  // Designations
  rentStabilized: z.boolean().optional(),
  landmarkStatus: z.string().max(30).optional(),
  aepStatus: z.string().max(20).optional(),
  buildingStatus: z.string().max(30).optional(),

  // Systems
  boilerType: z.string().max(30).optional(),
  boilerInstallYear: z.number().int().min(1950).max(2100).optional(),
  hotWaterType: z.string().max(30).optional(),
  gasType: z.string().max(20).optional(),
  elevator: z.boolean().optional(),
  elevatorCount: z.number().int().min(0).max(50).optional(),
  sprinklerSystem: z.boolean().optional(),
  fireAlarmSystem: z.boolean().optional(),
  oilTank: z.boolean().optional(),

  // People
  ownerName: z.string().max(200).optional(),
  managementCompany: z.string().max(200).optional(),
  propertyManager: z.string().max(200).optional(),
  superintendent: z.string().max(200).optional(),

  // Meta
  lastInspectionDate: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Compliance & Violation Schemas ──────────────────────────────

export const violationSyncSchema = z.object({
  buildingId: z.string().optional(),
  sources: z.array(z.enum(["HPD", "DOB", "ECB", "FDNY", "DSNY", "DOHMH", "DOB_COMPLAINTS", "HPD_COMPLAINTS", "HPD_LITIGATION"])).optional(),
});

export const complianceItemCreateSchema = z.object({
  buildingId: z.string().min(1),
  type: z.string().min(1),
  category: z.enum(["LOCAL_LAW", "INSPECTION", "FILING", "CUSTOM"]),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  dueDate: z.string().nullable().optional(),
  frequency: z.enum(["ANNUAL", "SEMI_ANNUAL", "QUARTERLY", "FIVE_YEAR", "FOUR_YEAR", "ONE_TIME", "ON_EVENT"]),
  status: z.enum(["COMPLIANT", "NON_COMPLIANT", "PENDING", "OVERDUE", "SCHEDULED", "NOT_APPLICABLE"]).optional().default("PENDING"),
  lastCompletedDate: z.string().nullable().optional(),
  nextDueDate: z.string().nullable().optional(),
  assignedVendorId: z.string().nullable().optional(),
  cost: z.number().min(0).optional().default(0),
  filedBy: z.string().nullable().optional(),
  certificateUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  linkedViolationId: z.string().nullable().optional(),
  isCustom: z.boolean().optional().default(false),
});

export const complianceItemUpdateSchema = complianceItemCreateSchema.partial();

export const complianceGenerateSchema = z.object({
  buildingId: z.string().min(1),
});

// ── Utility Schemas ─────────────────────────────────────────

export const utilityMeterCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  utilityType: z.string().min(1),
  classification: z.enum(["unit_submeter", "building_master", "common_area", "shared_meter"]).default("unit_submeter"),
  providerName: z.string().nullable().optional(),
  meterNumber: z.string().nullable().optional(),
  serviceAddress: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const utilityMeterUpdateSchema = z.object({
  utilityType: z.string().min(1).optional(),
  providerName: z.string().nullable().optional(),
  meterNumber: z.string().nullable().optional(),
  serviceAddress: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  classification: z.enum(["unit_submeter", "building_master", "common_area", "shared_meter"]).optional(),
  notes: z.string().nullable().optional(),
  unitId: z.string().nullable().optional(),
});

export const utilityAccountCreateSchema = z.object({
  utilityMeterId: z.string().min(1),
  accountNumber: z.string().nullable().optional(),
  assignedPartyType: z.string().min(1),
  assignedPartyName: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const utilityAccountUpdateSchema = z.object({
  accountNumber: z.string().nullable().optional(),
  assignedPartyType: z.string().min(1).optional(),
  assignedPartyName: z.string().nullable().optional(),
  tenantId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.string().optional(),
  closedWithBalance: z.boolean().optional(),
  closeReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const utilityCheckCreateSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2099),
  isPaid: z.boolean().optional(),
  paidDate: z.string().nullable().optional(),
  amount: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const utilityCheckUpdateSchema = z.object({
  isPaid: z.boolean().optional(),
  paidDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Turnover Schemas ────────────────────────────────────────

export const turnoverCreateSchema = z.object({
  unitId: z.string().min(1),
  buildingId: z.string().min(1),
  moveOutDate: z.string().nullable().optional(),
  moveOutSource: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

export const turnoverVendorCreateSchema = z.object({
  vendorId: z.string().nullable().optional(),
  vendorName: z.string().min(1),
  trade: z.string().min(1),
  scheduledDate: z.string().nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const turnoverVendorUpdateSchema = z.object({
  status: z.enum(["PENDING", "SCHEDULED", "COMPLETED"]).optional(),
  scheduledDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── Turnover Schemas (continued) ────────────────────────────
export const turnoverUpdateSchema = z.object({
  status: z.enum([
    "PENDING_INSPECTION", "INSPECTION_DONE", "SCOPE_CREATED",
    "VENDORS_ASSIGNED", "READY_TO_LIST", "LISTED", "COMPLETE",
  ]).optional(),
  inspectionDate: z.string().nullable().optional(),
  inspectionNotes: z.string().nullable().optional(),
  inspectionChecklist: z.unknown().optional(),
  scopeOfWork: z.string().nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  listedDate: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
});

// ── Collection Schemas ──────────────────────────────────────

export const collectionNoteCreateSchema = z.object({
  content: z.string().min(1).max(2000),
  actionType: z.enum([
    "CALLED", "LEFT_VOICEMAIL", "TEXTED", "EMAILED", "NOTICE_SENT",
    "PAYMENT_PLAN", "PARTIAL_PAYMENT", "PROMISE_TO_PAY", "SENT_TO_LEGAL", "OTHER",
  ]),
  followUpDate: z.string().optional(),
});

export const collectionStatusUpdateSchema = z.object({
  status: z.enum([
    // CollectionCase.status values (canonical, from statuses.ts)
    "monitoring", "demand_sent", "legal_referred", "payment_plan", "resolved",
    // CollectionStatus enum values (ARSnapshot / Tenant status transitions)
    "CURRENT", "LATE", "DELINQUENT", "CHRONIC", "PAYMENT_PLAN", "LEGAL",
    "VACATE_PENDING", "HARDSHIP", "WRITTEN_OFF",
  ]),
});

export const aiChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
  })).min(1),
  tenantId: z.string().optional(),
});

// ── Legal Review Schema ─────────────────────────────────────

export const legalReviewSchema = z.object({
  queueId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  tenantId: z.string().optional(),
});

// ── Leasing Activity Schema ─────────────────────────────────

export const leasingActivityCreateSchema = z.object({
  unitId: z.string().min(1),
  buildingId: z.string().min(1),
  type: z.string().min(1),
  description: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
});

// ── Unit Schemas ────────────────────────────────────────────

export const unitCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitNumber: z.string().min(1),
  unitType: z.string().nullable().optional(),
});

export const unitUpdateSchema = z.object({
  unitNumber: z.string().min(1).optional(),
  unitType: z.string().nullable().optional(),
  isVacant: z.boolean().optional(),
  askingRent: z.number().min(0).nullable().optional(),
  vacancyStatus: z.enum(["VACANT", "PRE_TURNOVER", "TURNOVER", "READY_TO_SHOW", "RENT_PROPOSED", "RENT_APPROVED", "LISTED", "LEASED", "OCCUPIED"]).nullable().optional(),
  bedroomCount: z.number().int().min(0).max(20).nullable().optional(),
  bathroomCount: z.number().min(0).max(20).multipleOf(0.5).nullable().optional(),
  squareFeet: z.number().int().min(0).nullable().optional(),
  legalRent: z.number().min(0).nullable().optional(),
  accessType: z.enum(["MASTER_KEY", "SUPER", "LOCKBOX", "COMBINATION"]).nullable().optional(),
  accessNotes: z.string().nullable().optional(),
  superName: z.string().nullable().optional(),
  superPhone: z.string().nullable().optional(),
  vacantSince: z.coerce.date().nullable().optional(),
  readyDate: z.coerce.date().nullable().optional(),
});

// ── Signal Schema ───────────────────────────────────────────

export const signalUpdateSchema = z.object({
  action: z.enum(["acknowledge", "resolve"]).optional(),
  resolutionNote: z.string().nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  snoozedUntil: z.string().nullable().optional(),
});

// ── Assign Buildings Schema ─────────────────────────────────

export const assignBuildingsSchema = z.object({
  buildingIds: z.array(z.string()),
});

// ── Lease Schemas ───────────────────────────────────────────

export const leaseCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  monthlyRent: z.number().min(0),
  chargeCode: z.string().nullable().optional(),
  securityDeposit: z.number().min(0).optional().default(0),
  moveInDate: z.string().nullable().optional(),
  leaseEnd: z.string().nullable().optional(),
  currentBalance: z.number().default(0),
  status: z.enum(["ACTIVE", "EXPIRED", "MONTH_TO_MONTH", "RENEWED", "TERMINATED", "PENDING"]).default("ACTIVE"),
  isCurrent: z.boolean().default(false),
});

export const leaseUpdateSchema = leaseCreateSchema.partial();

// ── Deduplicate Schema ──────────────────────────────────────

export const deduplicateMergeSchema = z.object({
  keepId: z.string().min(1),
  mergeIds: z.array(z.string().min(1)).min(1),
});

// ── AI Text Enhancement Schema ──────────────────────────────

// Context-aware max lengths for AI text enhancement
const CONTEXT_MAX_LENGTH: Record<string, number> = {
  legal_demand_letter: 6000,
  legal_note: 4000,
  collection_note: 2000,
  work_order_description: 2000,
  work_order_note: 2000,
  violation_note: 2000,
  tenant_note: 2000,
  general: 2000,
};

export const enhanceTextSchema = z.object({
  text: z.string().min(10, "Text must be at least 10 characters"),
  context: z.enum([
    "collection_note",
    "legal_note",
    "work_order_description",
    "work_order_note",
    "violation_note",
    "tenant_note",
    "legal_demand_letter",
    "general",
  ]),
}).superRefine((data, ctx) => {
  const maxLen = CONTEXT_MAX_LENGTH[data.context] ?? 2000;
  if (data.text.length > maxLen) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: maxLen,
      type: "string",
      inclusive: true,
      path: ["text"],
      message: `Text too long for context "${data.context}". Max ${maxLen} characters.`,
    });
  }
});

// ── Project Schemas ─────────────────────────────────────────

const PROJECT_CATEGORIES = [
  "TURNOVER", "CAPITAL_IMPROVEMENT", "VIOLATION_REMEDIATION", "LOCAL_LAW",
  "FACADE", "ROOF", "BOILER", "PLUMBING", "ELECTRICAL", "APARTMENT_RENO",
  "ELEVATOR", "FIRE_SAFETY", "GENERAL_MAINTENANCE", "COSMETIC", "OTHER",
] as const;

const PROJECT_STATUSES = [
  "PLANNED", "ESTIMATING", "PENDING_APPROVAL", "APPROVED", "IN_PROGRESS",
  "PAUSED", "SUBSTANTIALLY_COMPLETE", "COMPLETED", "CLOSED", "CANCELLED",
] as const;

const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const projectCreateSchema = z.object({
  buildingId: z.string().min(1),
  unitId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.enum(PROJECT_CATEGORIES),
  status: z.enum(PROJECT_STATUSES).optional().default("PLANNED"),
  priority: z.enum(PROJECT_PRIORITIES).optional().default("MEDIUM"),
  scopeOfWork: z.string().nullable().optional(),
  estimatedBudget: z.number().nullable().optional(),
  ownerVisible: z.boolean().optional().default(false),
  requiresApproval: z.boolean().optional().default(false),
  startDate: z.string().nullable().optional(),
  targetEndDate: z.string().nullable().optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PROJECT_PRIORITIES).optional(),
  scopeOfWork: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  vendorId: z.string().nullable().optional(),
  ownerVisible: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  estimatedBudget: z.number().nullable().optional(),
  approvedBudget: z.number().nullable().optional(),
  actualCost: z.number().nullable().optional(),
  contingency: z.number().nullable().optional(),
  startDate: z.string().nullable().optional(),
  targetEndDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
});

export const budgetLineCreateSchema = z.object({
  category: z.string().min(1),
  description: z.string().nullable().optional(),
  estimated: z.number(),
  actual: z.number().nullable().optional(),
});

export const changeOrderCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  amount: z.number(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional().default("DRAFT"),
});

export const milestoneCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const milestoneUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const linkViolationSchema = z.object({
  violationId: z.string().min(1),
});

export const linkWorkOrderSchema = z.object({
  workOrderId: z.string().min(1),
});

export const violationCertifySchema = z.object({
  notes: z.string().nullable().optional(),
});

// ── Import Staging Review Schema ────────────────────────────────

export const importStagingReviewSchema = z.object({
  id: z.string().min(1, "Staging batch id is required"),
  action: z.enum(["approve", "reject"]),
  notes: z.string().nullable().optional(),
});

// ── Comms Schemas ───────────────────────────────────────────

export const conversationCreateSchema = z.object({
  type: z.enum(["direct", "group", "work_order", "violation", "legal_case", "building", "unit", "turnover"]),
  targetUserId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  memberIds: z.array(z.string()).optional(),
  relatedEntityType: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  buildingId: z.string().nullable().optional(),
});

export const messageCreateSchema = z.object({
  body: z.string().min(1, "Message body is required"),
  messageType: z.enum(["standard", "status_update", "blocker", "approval_request", "vendor_update", "internal_note", "system_event"]).optional(),
  replyToMessageId: z.string().nullable().optional(),
  mentionedUserIds: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});
