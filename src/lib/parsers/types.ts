import { z } from "zod";

export interface ParseError {
  row: number;
  field: string;
  reason: string;
  suggestedFix?: string;
}

export interface ParseResult<T = Record<string, unknown>> {
  success: boolean;
  parserUsed: string;
  confidence: number;
  data: T[];
  errors: ParseError[];
  warnings: string[];
}

// Shared row schemas
export const buildingRowSchema = z.object({
  address: z.string().min(1),
  borough: z.string().optional(),
  block: z.string().optional(),
  lot: z.string().optional(),
  totalUnits: z.number().optional(),
  buildingType: z.string().optional(),
  portfolio: z.string().optional(),
  yearBuilt: z.number().optional(),
  hpdRegistration: z.string().optional(),
});

export const unitRowSchema = z.object({
  buildingAddress: z.string().min(1),
  unitNumber: z.string().min(1),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  sqFt: z.number().optional(),
  legalRent: z.number().optional(),
  marketRent: z.number().optional(),
  prefRent: z.number().optional(),
  status: z.string().optional(),
  rentStabilized: z.boolean().optional(),
});

export const tenantRowSchema = z.object({
  buildingAddress: z.string().min(1),
  unitNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  leaseStart: z.string().optional(),
  leaseEnd: z.string().optional(),
  monthlyRent: z.number().optional(),
  securityDeposit: z.number().optional(),
  balance: z.number().optional(),
  moveInDate: z.string().optional(),
});

export const workOrderRowSchema = z.object({
  buildingAddress: z.string().min(1),
  unitNumber: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  createdDate: z.string().optional(),
  completedDate: z.string().optional(),
  cost: z.number().optional(),
});

export const legalCaseRowSchema = z.object({
  buildingAddress: z.string().min(1),
  unitNumber: z.string().min(1),
  tenantName: z.string().min(1),
  balance: z.number().optional(),
  legalStage: z.string().optional(),
  attorneyName: z.string().optional(),
  filedDate: z.string().optional(),
  nextCourtDate: z.string().optional(),
  indexNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const vendorRowSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  trade: z.string().optional(),
  licenseNumber: z.string().optional(),
  insuranceExpiry: z.string().optional(),
  notes: z.string().optional(),
});

export const arBalanceRowSchema = z.object({
  buildingAddress: z.string().min(1),
  unitNumber: z.string().min(1),
  tenantName: z.string().min(1),
  days0_30: z.number().optional(),
  days30_60: z.number().optional(),
  days60_90: z.number().optional(),
  days90_120: z.number().optional(),
  days120Plus: z.number().optional(),
  totalBalance: z.number().optional(),
  lastPaymentDate: z.string().optional(),
  lastPaymentAmount: z.number().optional(),
});

export const utilityRowSchema = z.object({
  buildingAddress: z.string().min(1),
  provider: z.string().min(1),
  accountNumber: z.string().optional(),
  meterNumber: z.string().optional(),
  serviceAddress: z.string().optional(),
  notes: z.string().optional(),
});
