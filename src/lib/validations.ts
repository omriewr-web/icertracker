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
