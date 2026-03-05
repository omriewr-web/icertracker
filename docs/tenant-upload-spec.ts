// ============================================================================
// AtlasPM Tenant Upload Specification
// Single-file flat format for NYC multifamily tenant & lease data
// ============================================================================

import { z } from "zod";

// ─── 1. Final Recommended Column Order ──────────────────────────────────────
//
// Grouped logically: linkage → identity → occupancy → lease/rent → collections → admin
//
// tenant_id            — External unique key per tenant (e.g. TNT-001, Yardi ID)
// building_id          — Links to Building master sheet (e.g. BLD-001)
// building_name        — Display-only, for human readability in the sheet
// address              — Display-only, helps staff locate the building
// unit                 — Unit/apt number within the building
// tenant_code          — Yardi T-Code or internal reference
// first_name           — Tenant first name (parsed or entered)
// last_name            — Tenant last name (parsed or entered)
// full_name            — Full display name (required for occupied units)
// phone                — Primary contact phone
// email                — Primary contact email
// occupancy_status     — occupied | vacant | notice | pending_move_in | pending_move_out
// move_in_date         — Tenant move-in date (YYYY-MM-DD)
// move_out_date        — Actual or expected move-out date
// lease_start_date     — Current lease start
// lease_end_date       — Current lease end
// renewal_status       — pending | renewed | declined | not_applicable
// household_size       — Number of occupants (integer)
// lease_status         — active | expired | month_to_month | future | terminated | vacant
// monthly_rent         — Contract/actual rent amount tenant pays
// current_charges      — Total charges for current billing period
// security_deposit     — Security deposit amount on file
// subsidy_type         — none | section_8 | fheps | cityfheps | hasa | linc | other
// subsidy_amount       — Monthly subsidy portion paid by program
// tenant_portion       — Monthly amount tenant is responsible for
// preferential_rent    — Preferential rent amount (if applicable, rent-stabilized)
// legal_rent           — Legal/registered rent (rent-stabilized ceiling)
// current_balance      — Total outstanding balance (all charges)
// past_due_balance     — Balance older than current billing cycle
// last_payment_date    — Date of most recent payment
// last_payment_amount  — Amount of most recent payment
// arrears_status       — current | delinquent | severe_delinquency | legal | payment_plan
// rent_stabilized      — Boolean: is this a rent-stabilized tenancy
// lease_type           — renewal | initial | month_to_month | succession | sublet
// payment_frequency    — monthly | weekly | biweekly
// billing_status       — active | suspended | closed
// active_recurring_charges — Semicolon-separated list (e.g. "Rent;Water/Sewer;Parking")
// notes                — Free text for additional info, secondary tenants, special conditions


// ─── 3. Field Types ────────────────────────────────────────────────────────

export const FIELD_TYPES = {
  // Linkage
  tenant_id:                "string",   // max 50
  building_id:              "string",   // max 50, links to building_id in Building sheet
  building_name:            "string",   // max 200, display only
  address:                  "string",   // max 200, display only
  unit:                     "string",   // max 20

  // Identity
  tenant_code:              "string",   // max 30, Yardi T-Code
  first_name:               "string",   // max 100
  last_name:                "string",   // max 100
  full_name:                "string",   // max 200
  phone:                    "string",   // max 30
  email:                    "string",   // max 200, validated as email when present

  // Occupancy
  occupancy_status:         "enum",     // occupied | vacant | notice | pending_move_in | pending_move_out
  move_in_date:             "date",     // YYYY-MM-DD
  move_out_date:            "date",     // YYYY-MM-DD
  lease_start_date:         "date",     // YYYY-MM-DD
  lease_end_date:           "date",     // YYYY-MM-DD
  renewal_status:           "enum",     // pending | renewed | declined | not_applicable
  household_size:           "integer",  // min 0, max 20

  // Lease / Rent
  lease_status:             "enum",     // active | expired | month_to_month | future | terminated | vacant
  monthly_rent:             "decimal",  // 2 decimal places, >= 0
  current_charges:          "decimal",  // 2 decimal places, >= 0
  security_deposit:         "decimal",  // 2 decimal places, >= 0
  subsidy_type:             "enum",     // none | section_8 | fheps | cityfheps | hasa | linc | other
  subsidy_amount:           "decimal",  // 2 decimal places, >= 0
  tenant_portion:           "decimal",  // 2 decimal places, >= 0
  preferential_rent:        "decimal",  // 2 decimal places, >= 0, nullable
  legal_rent:               "decimal",  // 2 decimal places, >= 0

  // Collections
  current_balance:          "decimal",  // 2 decimal places, can be negative (credit)
  past_due_balance:         "decimal",  // 2 decimal places, >= 0
  last_payment_date:        "date",     // YYYY-MM-DD
  last_payment_amount:      "decimal",  // 2 decimal places, >= 0
  arrears_status:           "enum",     // current | delinquent | severe_delinquency | legal | payment_plan

  // Administration
  rent_stabilized:          "boolean",  // true/false, yes/no, 1/0
  lease_type:               "enum",     // renewal | initial | month_to_month | succession | sublet
  payment_frequency:        "enum",     // monthly | weekly | biweekly
  billing_status:           "enum",     // active | suspended | closed
  active_recurring_charges: "string",   // semicolon-separated list, max 500
  notes:                    "string",   // free text, max 2000
} as const;


// ─── 4. JSON Schema (Zod) for Upload Validation ────────────────────────────

const OCCUPANCY_STATUSES = ["occupied", "vacant", "notice", "pending_move_in", "pending_move_out"] as const;
const LEASE_STATUSES = ["active", "expired", "month_to_month", "future", "terminated", "vacant"] as const;
const ARREARS_STATUSES = ["current", "delinquent", "severe_delinquency", "legal", "payment_plan"] as const;
const SUBSIDY_TYPES = ["none", "section_8", "fheps", "cityfheps", "hasa", "linc", "other"] as const;
const RENEWAL_STATUSES = ["pending", "renewed", "declined", "not_applicable"] as const;
const LEASE_TYPES = ["renewal", "initial", "month_to_month", "succession", "sublet"] as const;
const PAYMENT_FREQUENCIES = ["monthly", "weekly", "biweekly"] as const;
const BILLING_STATUSES = ["active", "suspended", "closed"] as const;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.string().regex(dateRegex, "Must be YYYY-MM-DD").optional();
const money = z.number().min(-999999).max(999999);
const optionalMoney = money.optional();

export const tenantUploadSchema = z.object({
  // Linkage
  tenant_id: z.string().min(1).max(50).optional(),
  building_id: z.string().min(1).max(50),
  building_name: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  unit: z.string().min(1).max(20),

  // Identity
  tenant_code: z.string().max(30).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  full_name: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),

  // Occupancy
  occupancy_status: z.enum(OCCUPANCY_STATUSES),
  move_in_date: optionalDate,
  move_out_date: optionalDate,
  lease_start_date: optionalDate,
  lease_end_date: optionalDate,
  renewal_status: z.enum(RENEWAL_STATUSES).optional(),
  household_size: z.number().int().min(0).max(20).optional(),

  // Lease / Rent
  lease_status: z.enum(LEASE_STATUSES).optional(),
  monthly_rent: optionalMoney,
  current_charges: optionalMoney,
  security_deposit: optionalMoney,
  subsidy_type: z.enum(SUBSIDY_TYPES).optional(),
  subsidy_amount: optionalMoney,
  tenant_portion: optionalMoney,
  preferential_rent: optionalMoney,
  legal_rent: optionalMoney,

  // Collections
  current_balance: optionalMoney,
  past_due_balance: optionalMoney,
  last_payment_date: optionalDate,
  last_payment_amount: optionalMoney,
  arrears_status: z.enum(ARREARS_STATUSES).optional(),

  // Administration
  rent_stabilized: z.boolean().optional(),
  lease_type: z.enum(LEASE_TYPES).optional(),
  payment_frequency: z.enum(PAYMENT_FREQUENCIES).optional(),
  billing_status: z.enum(BILLING_STATUSES).optional(),
  active_recurring_charges: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
}).refine(
  (data) => {
    // Occupied units must have full_name or (first_name + last_name)
    if (data.occupancy_status !== "vacant") {
      return !!(data.full_name || (data.first_name && data.last_name));
    }
    return true;
  },
  { message: "Occupied units must have full_name or first_name + last_name", path: ["full_name"] }
);

export type TenantUploadRow = z.infer<typeof tenantUploadSchema>;


// ─── 5. TypeScript Interface ────────────────────────────────────────────────

export interface TenantRecord {
  // Linkage
  tenant_id?: string;
  building_id: string;
  building_name?: string;
  address?: string;
  unit: string;

  // Identity
  tenant_code?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  email?: string;

  // Occupancy
  occupancy_status: "occupied" | "vacant" | "notice" | "pending_move_in" | "pending_move_out";
  move_in_date?: string;
  move_out_date?: string;
  lease_start_date?: string;
  lease_end_date?: string;
  renewal_status?: "pending" | "renewed" | "declined" | "not_applicable";
  household_size?: number;

  // Lease / Rent
  lease_status?: "active" | "expired" | "month_to_month" | "future" | "terminated" | "vacant";
  monthly_rent?: number;
  current_charges?: number;
  security_deposit?: number;
  subsidy_type?: "none" | "section_8" | "fheps" | "cityfheps" | "hasa" | "linc" | "other";
  subsidy_amount?: number;
  tenant_portion?: number;
  preferential_rent?: number;
  legal_rent?: number;

  // Collections
  current_balance?: number;
  past_due_balance?: number;
  last_payment_date?: string;
  last_payment_amount?: number;
  arrears_status?: "current" | "delinquent" | "severe_delinquency" | "legal" | "payment_plan";

  // Administration
  rent_stabilized?: boolean;
  lease_type?: "renewal" | "initial" | "month_to_month" | "succession" | "sublet";
  payment_frequency?: "monthly" | "weekly" | "biweekly";
  billing_status?: "active" | "suspended" | "closed";
  active_recurring_charges?: string;
  notes?: string;
}


// ─── 6. SQL CREATE TABLE (PostgreSQL) ───────────────────────────────────────

export const CREATE_TABLE_SQL = `
CREATE TABLE tenants_import (
  -- Internal
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkage
  tenant_id                VARCHAR(50),
  building_id              VARCHAR(50) NOT NULL,
  building_name            VARCHAR(200),
  address                  VARCHAR(200),
  unit                     VARCHAR(20) NOT NULL,

  -- Identity
  tenant_code              VARCHAR(30),
  first_name               VARCHAR(100),
  last_name                VARCHAR(100),
  full_name                VARCHAR(200),
  phone                    VARCHAR(30),
  email                    VARCHAR(200),

  -- Occupancy
  occupancy_status         VARCHAR(20) NOT NULL
                             CHECK (occupancy_status IN ('occupied','vacant','notice','pending_move_in','pending_move_out')),
  move_in_date             DATE,
  move_out_date            DATE,
  lease_start_date         DATE,
  lease_end_date           DATE,
  renewal_status           VARCHAR(20)
                             CHECK (renewal_status IN ('pending','renewed','declined','not_applicable')),
  household_size           SMALLINT CHECK (household_size BETWEEN 0 AND 20),

  -- Lease / Rent
  lease_status             VARCHAR(20)
                             CHECK (lease_status IN ('active','expired','month_to_month','future','terminated','vacant')),
  monthly_rent             NUMERIC(10,2),
  current_charges          NUMERIC(10,2),
  security_deposit         NUMERIC(10,2),
  subsidy_type             VARCHAR(20) DEFAULT 'none'
                             CHECK (subsidy_type IN ('none','section_8','fheps','cityfheps','hasa','linc','other')),
  subsidy_amount           NUMERIC(10,2) DEFAULT 0,
  tenant_portion           NUMERIC(10,2),
  preferential_rent        NUMERIC(10,2),
  legal_rent               NUMERIC(10,2),

  -- Collections
  current_balance          NUMERIC(10,2) DEFAULT 0,
  past_due_balance         NUMERIC(10,2) DEFAULT 0,
  last_payment_date        DATE,
  last_payment_amount      NUMERIC(10,2),
  arrears_status           VARCHAR(25) DEFAULT 'current'
                             CHECK (arrears_status IN ('current','delinquent','severe_delinquency','legal','payment_plan')),

  -- Administration
  rent_stabilized          BOOLEAN DEFAULT FALSE,
  lease_type               VARCHAR(20)
                             CHECK (lease_type IN ('renewal','initial','month_to_month','succession','sublet')),
  payment_frequency        VARCHAR(10) DEFAULT 'monthly'
                             CHECK (payment_frequency IN ('monthly','weekly','biweekly')),
  billing_status           VARCHAR(10) DEFAULT 'active'
                             CHECK (billing_status IN ('active','suspended','closed')),
  active_recurring_charges TEXT,
  notes                    TEXT,

  -- Meta
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Unique Constraints ──
CREATE UNIQUE INDEX idx_tenants_import_tenant_id
  ON tenants_import (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tenants_import_building_unit_name
  ON tenants_import (building_id, unit, full_name)
  WHERE occupancy_status != 'vacant' AND full_name IS NOT NULL;

-- ── Indexes ──
CREATE INDEX idx_tenants_import_building_id ON tenants_import (building_id);
CREATE INDEX idx_tenants_import_unit ON tenants_import (building_id, unit);
CREATE INDEX idx_tenants_import_tenant_code ON tenants_import (tenant_code) WHERE tenant_code IS NOT NULL;
CREATE INDEX idx_tenants_import_occupancy ON tenants_import (occupancy_status);
CREATE INDEX idx_tenants_import_lease_status ON tenants_import (lease_status) WHERE lease_status IS NOT NULL;
CREATE INDEX idx_tenants_import_arrears ON tenants_import (arrears_status) WHERE arrears_status NOT IN ('current');
CREATE INDEX idx_tenants_import_lease_end ON tenants_import (lease_end_date) WHERE lease_end_date IS NOT NULL;
CREATE INDEX idx_tenants_import_balance ON tenants_import (current_balance) WHERE current_balance > 0;
CREATE INDEX idx_tenants_import_subsidy ON tenants_import (subsidy_type) WHERE subsidy_type != 'none';
CREATE INDEX idx_tenants_import_stabilized ON tenants_import (rent_stabilized) WHERE rent_stabilized = TRUE;
CREATE INDEX idx_tenants_import_name ON tenants_import USING gin (full_name gin_trgm_ops) WHERE full_name IS NOT NULL;
`;


// ─── 7. Validation Rules ───────────────────────────────────────────────────

export const VALIDATION_RULES = {

  // ── 8. Required vs Optional Fields ──

  required_occupied: [
    "building_id",       // Must link to a building
    "unit",              // Must identify the apartment
    "full_name",         // OR first_name + last_name — need at least one name
    "occupancy_status",  // Must be set
    "monthly_rent",      // Need a rent amount for occupied units
  ],

  required_vacant: [
    "building_id",       // Must link to a building
    "unit",              // Must identify the apartment
    "occupancy_status",  // Must be "vacant"
  ],

  required_always: [
    "building_id",
    "unit",
    "occupancy_status",
  ],

  unique_fields: [
    "tenant_id",                          // Unique per tenant when provided
    "building_id + unit + full_name",     // Composite: one tenant name per unit per building
    "tenant_code",                        // Yardi T-Code is unique when provided
  ],

  field_formats: {
    tenant_id:        "Alphanumeric + hyphens, 1-50 chars (e.g. TNT-001, t0012847)",
    building_id:      "Must match a building_id from the Building master sheet",
    unit:             "Unit/apt identifier, 1-20 chars (e.g. 4A, 12F, PH-1, BSMT)",
    full_name:        "Full display name, 1-200 chars. Required for occupied units.",
    phone:            "Any format accepted, stored as-is (e.g. 212-555-0143, (718) 555-0277)",
    email:            "Valid email format when provided",
    occupancy_status: "One of: occupied, vacant, notice, pending_move_in, pending_move_out",
    move_in_date:     "YYYY-MM-DD format",
    move_out_date:    "YYYY-MM-DD format",
    lease_start_date: "YYYY-MM-DD format",
    lease_end_date:   "YYYY-MM-DD format",
    monthly_rent:     "Decimal, 2 places (e.g. 1875.00). Required for occupied units.",
    current_balance:  "Decimal, 2 places. Can be negative (tenant has credit).",
    subsidy_amount:   "Decimal. Set to 0 when subsidy_type is 'none'.",
    rent_stabilized:  "Boolean: true/false, yes/no, 1/0, y/n",
    active_recurring_charges: "Semicolon-separated list (e.g. 'Rent;Water/Sewer;Parking')",
  },

  allowed_values: {
    occupancy_status: ["occupied", "vacant", "notice", "pending_move_in", "pending_move_out"],
    lease_status:     ["active", "expired", "month_to_month", "future", "terminated", "vacant"],
    arrears_status:   ["current", "delinquent", "severe_delinquency", "legal", "payment_plan"],
    subsidy_type:     ["none", "section_8", "fheps", "cityfheps", "hasa", "linc", "other"],
    renewal_status:   ["pending", "renewed", "declined", "not_applicable"],
    lease_type:       ["renewal", "initial", "month_to_month", "succession", "sublet"],
    payment_frequency: ["monthly", "weekly", "biweekly"],
    billing_status:   ["active", "suspended", "closed"],
  },

  cross_field_rules: [
    "If occupancy_status is 'vacant', tenant identity fields (full_name, first_name, last_name, phone, email) may all be blank",
    "If occupancy_status is 'vacant', lease_status should be 'vacant' or 'terminated'",
    "If occupancy_status is NOT 'vacant', full_name OR (first_name + last_name) is required",
    "If occupancy_status is NOT 'vacant', monthly_rent is required",
    "If subsidy_type is 'none', subsidy_amount should be 0 or blank",
    "If subsidy_type is NOT 'none', subsidy_amount should be > 0 (warning, not error)",
    "tenant_portion + subsidy_amount should approximately equal monthly_rent (warning, not error)",
    "If preferential_rent is set, legal_rent should also be set and legal_rent >= preferential_rent",
    "lease_start_date should be <= lease_end_date when both are present",
    "move_in_date should be <= move_out_date when both are present",
    "If arrears_status is 'current', current_balance should be <= monthly_rent (warning)",
    "If arrears_status is 'legal', there should ideally be a corresponding legal case (cross-module check)",
    "If lease_end_date is in the past and lease_status is 'active', auto-suggest 'expired' or 'month_to_month'",
  ],

  // ── 9. Recommended Indexes ──

  recommended_indexes: [
    "building_id                    — Primary lookup: all tenants in a building",
    "building_id + unit             — Unit-level lookup (composite)",
    "tenant_id                      — Unique external key lookup (partial, WHERE NOT NULL)",
    "tenant_code                    — Yardi T-Code lookup (partial, WHERE NOT NULL)",
    "occupancy_status               — Filter by occupancy",
    "lease_status                   — Filter by lease state",
    "arrears_status                 — Collections filtering (partial, WHERE != 'current')",
    "lease_end_date                 — Expiring leases dashboard (partial, WHERE NOT NULL)",
    "current_balance                — Balance-based queries/sorting (partial, WHERE > 0)",
    "subsidy_type                   — Subsidy program filtering (partial, WHERE != 'none')",
    "rent_stabilized                — Stabilization filtering (partial, WHERE = TRUE)",
    "full_name (trigram)            — Fuzzy tenant name search",
  ],
};


// ─── 10. Recommendations: Fields to Add or Remove ──────────────────────────

export const FIELD_RECOMMENDATIONS = {
  add: [
    {
      field: "unit_type",
      type: "string",
      reason: "Studio, 1BR, 2BR, 3BR, etc. Essential for vacancy marketing, fair housing reporting, and rent comparables. Yardi exports often include this.",
      values: ["studio", "1br", "2br", "3br", "4br", "5br", "room", "commercial", "other"],
    },
    {
      field: "bedroom_count",
      type: "integer",
      reason: "Numeric bedroom count. Needed for HPD registration, household size compliance, and Section 8 voucher sizing. Complements unit_type.",
    },
    {
      field: "subsidy_voucher_id",
      type: "string",
      reason: "Section 8 / FHEPS / CityFHEPS voucher number. Required for HAP contract tracking, annual re-certifications, and subsidy agency correspondence.",
    },
    {
      field: "recertification_date",
      type: "date",
      reason: "Next recertification due date for subsidized tenants. Missing recerts cause subsidy payment interruptions — tracking this prevents revenue loss.",
    },
    {
      field: "legal_status",
      type: "enum",
      values: ["none", "notice_sent", "case_filed", "in_court", "stipulation", "judgment", "warrant"],
      reason: "Inline legal status per tenant. Avoids cross-referencing the legal module for basic collections dashboards. Can sync from legal cases module.",
    },
  ],
  keep_as_is: [
    {
      field: "building_name / address",
      reason: "Redundant with building_id but critical for human readability when staff edit the sheet in Excel. Keep as display-only, not used for matching.",
    },
    {
      field: "first_name / last_name / full_name",
      reason: "Keep all three. Yardi exports use full_name. Staff sometimes enter first/last separately. Parser should auto-derive full_name from parts if missing.",
    },
  ],
  do_not_add: [
    {
      field: "ssn / ssn_last4",
      reason: "PII security risk in flat files. If needed, collect through a secure form in the app, never via spreadsheet upload.",
    },
    {
      field: "bank_account / routing_number",
      reason: "Financial PII. Handle through ACH setup in the app, never in import files.",
    },
    {
      field: "individual_charge_rows",
      reason: "Yardi exports often have one row per charge code. Collapse these into one row per tenant during import (sum charges, concatenate charge names). Do NOT try to match the Yardi charge-per-row format.",
    },
  ],
};


// ─── Implementation Guidance ────────────────────────────────────────────────

export const IMPLEMENTATION_GUIDANCE = {

  // ── Handling Missing Names ──
  missing_names: `
    1. If full_name is provided but first_name/last_name are blank:
       - Split on the LAST space: "Maria Elena Santos" → first="Maria Elena", last="Santos"
       - If single word: first=full_name, last=""
    2. If first_name + last_name are provided but full_name is blank:
       - Concatenate: full_name = first_name + " " + last_name
    3. If ALL name fields are blank and occupancy_status != "vacant":
       - Add validation warning (not error)
       - Set full_name = "Unknown Tenant"
       - Preserve the row — missing name is better than missing tenant data
  `,

  // ── Handling Vacant Units ──
  vacant_units: `
    1. Vacant rows must have occupancy_status = "vacant"
    2. Tenant identity fields (name, phone, email, tenant_code) should be blank
    3. monthly_rent should still reflect the asking/market rent for the unit
    4. legal_rent should reflect the registered rent (if stabilized)
    5. current_balance should be 0 (no tenant to owe money)
    6. lease_status should be "vacant"
    7. If previous tenant info is relevant, put it in notes
    8. building_id + unit are still required — this creates a vacancy record
  `,

  // ── Handling Duplicate Tenants ──
  duplicate_detection: `
    Match priority (same as building import):
    1. tenant_code (Yardi T-Code) — exact match, highest confidence
    2. building_id + unit + full_name — composite match
    3. building_id + unit — if only one non-vacant tenant exists for that unit

    When a duplicate is found:
    - UPDATE the existing record (don't create a second one)
    - Merge financial data (take the newer balance, more recent payment date)
    - Preserve notes by appending, not overwriting

    When ambiguous:
    - If multiple tenants exist for the same unit, flag for manual review
    - Never silently overwrite — log the conflict
  `,

  // ── Handling Expired Leases ──
  expired_leases: `
    1. If lease_end_date < today AND lease_status = "active":
       - Auto-set lease_status to "month_to_month" (NYC default for holdover tenants)
       - Add import note: "Lease expired [date], auto-set to month-to-month"
    2. If lease_end_date < today AND occupancy_status = "occupied":
       - This is normal in NYC (month-to-month holdover) — do NOT reject the row
    3. If lease_end_date < today AND occupancy_status = "vacant":
       - Set lease_status = "terminated"
    4. Track original lease_status from the file in case staff intentionally set it
  `,

  // ── Collapsing Yardi Charge Rows ──
  yardi_charge_collapse: `
    Yardi rent rolls often export ONE ROW PER CHARGE CODE per tenant:
      Unit 4A | Maria Santos | RENT  | 1875.00
      Unit 4A | Maria Santos | WATER |   45.00
      Unit 4A | Maria Santos | PARK  |  100.00

    Collapse logic:
    1. Group by (building_id OR address) + unit + tenant_name
    2. For the collapsed row:
       - monthly_rent = amount from the "RENT" charge code row
       - current_charges = SUM of all charge amounts
       - active_recurring_charges = semicolon-joined charge code names ("Rent;Water;Parking")
       - All other fields (dates, balances, status) come from the first/primary row
    3. Charge code identification (case-insensitive):
       - Rent: "RENT", "RNT", "CONTRACT RENT", "BASE RENT"
       - Subsidy: "HAP", "SECTION 8", "S8", "SUBSIDY", "FHEPS", "CITYFHEPS", "HASA"
       - Other: everything else → concatenate into active_recurring_charges
    4. If a "Balance" column exists, it typically appears only once per tenant
       (on the first charge row) — use that value for current_balance
  `,

  // ── Yardi Column Auto-Mapping ──
  yardi_column_map: `
    The parser should normalize all incoming headers to lowercase, strip
    whitespace/special characters, and match against this priority map.
    If no match is found, preserve the column value in an unmapped_fields
    JSON object on the row rather than discarding it.

    Exact matches (case-insensitive):
      "Tenant Name"       → full_name
      "Tenant"            → full_name
      "Resident Name"     → full_name
      "Resident"          → full_name
      "Name"              → full_name
      "T-Code"            → tenant_code
      "Tenant Code"       → tenant_code
      "TCode"             → tenant_code
      "Code"              → tenant_code
      "Unit"              → unit
      "Apt"               → unit
      "Apt #"             → unit
      "Apt Number"        → unit
      "Unit Number"       → unit
      "Property"          → building_name
      "Property Name"     → building_name
      "Building"          → building_name
      "Address"           → address
      "Building Address"  → address
      "Market Rent"       → legal_rent
      "Contract Rent"     → monthly_rent
      "Rent"              → monthly_rent
      "Monthly Rent"      → monthly_rent
      "Charge Amount"     → current_charges (summed in collapse)
      "Amount"            → current_charges (summed in collapse)
      "Balance"           → current_balance
      "Total Balance"     → current_balance
      "Balance Due"       → current_balance
      "Past Due"          → past_due_balance
      "Past Due Balance"  → past_due_balance
      "Move In"           → move_in_date
      "Move-In"           → move_in_date
      "Move In Date"      → move_in_date
      "Move Out"          → move_out_date
      "Move-Out"          → move_out_date
      "Move Out Date"     → move_out_date
      "Lease From"        → lease_start_date
      "Lease Start"       → lease_start_date
      "Lease Begin"       → lease_start_date
      "Lease To"          → lease_end_date
      "Lease End"         → lease_end_date
      "Lease Expiration"  → lease_end_date
      "Charge Code"       → _charge_code (internal, used for collapse logic)
      "Charge Description"→ _charge_code
      "Subsidy"           → subsidy_amount (if numeric) or subsidy_type (if text)
      "HAP"               → subsidy_amount
      "HAP Amount"        → subsidy_amount
      "Section 8"         → subsidy_type = "section_8", value → subsidy_amount
      "Deposit"           → security_deposit
      "Security Deposit"  → security_deposit
      "Sq Ft"             → (skip — belongs on unit/building, not tenant)
      "Phone"             → phone
      "Email"             → email
      "Status"            → occupancy_status (mapped through status normalization)
      "Lease Status"      → lease_status

    Status normalization:
      "Current" / "Active" / "Occupied"  → occupancy_status = "occupied"
      "Vacant" / "Empty"                 → occupancy_status = "vacant"
      "Notice" / "NTV" / "NTL"          → occupancy_status = "notice"
      "Pending" / "Applicant"            → occupancy_status = "pending_move_in"
      "Past" / "Former" / "Moved Out"   → occupancy_status = "pending_move_out"
  `,

  // ── Fallback Mapping for Ambiguous Columns ──
  fallback_logic: `
    When a column cannot be confidently mapped:
    1. Preserve the raw header name and cell value in an unmapped_fields JSON column
    2. Log a warning: "Column 'XYZ' not recognized — values preserved in unmapped_fields"
    3. Do NOT fail the import — partial data is better than no data
    4. On the preview screen, show unmapped columns so staff can manually assign them

    When a value is ambiguous:
    1. "Market Rent" with no "Contract Rent" column → use as monthly_rent AND legal_rent
    2. "Rent" alone → monthly_rent
    3. If both "Market Rent" and "Contract Rent" exist:
       - "Market Rent" → legal_rent
       - "Contract Rent" → monthly_rent
    4. Numeric "Subsidy" column → subsidy_amount, auto-set subsidy_type = "other"
    5. Text "Subsidy" column → subsidy_type (try to match known programs)
    6. "Status" column → try occupancy_status first, then lease_status
  `,
};
