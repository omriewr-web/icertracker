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
  filedDate: z.string().nullable().optional(),
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

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "PM", "COLLECTOR", "OWNER", "BROKER"]).default("COLLECTOR"),
});

export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "PM", "COLLECTOR", "OWNER", "BROKER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
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
