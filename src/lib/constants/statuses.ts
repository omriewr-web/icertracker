/**
 * Centralized status vocabulary for AtlasPM.
 *
 * Every status label, display name, and color mapping lives here.
 * Import from this file — never hardcode status strings elsewhere.
 *
 * DB enums (Prisma) remain as-is. This file defines the *app-layer*
 * display labels, normalization, and color mappings.
 */

// ── Color type used across all modules ────────────────────────

export interface StatusStyle {
  bg: string;
  text: string;
}

// ── Collection statuses ───────────────────────────────────────

export const COLLECTION_DISPLAY_LABELS = {
  CURRENT: "Active",
  LATE: "Late",
  FOLLOW_UP: "Follow Up",
  DELINQUENT: "Delinquent",
  LEGAL_REVIEW: "Legal Review",
  ESCALATED: "Escalated",
  LEGAL: "Legal",
  MONITORING: "Monitoring",
  PAYMENT_PLAN: "Payment Plan",
  RESOLVED: "Resolved",
  HARDSHIP: "Hardship",
  WRITTEN_OFF: "Written Off",
  VACATE_PENDING: "Vacate Pending",
} as const;

export type CollectionDisplayLabel = (typeof COLLECTION_DISPLAY_LABELS)[keyof typeof COLLECTION_DISPLAY_LABELS];

export const COLLECTION_STATUS_COLORS: Record<string, StatusStyle> = {
  "Active":         { bg: "bg-green-500/10",  text: "text-green-400" },
  "Late":           { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  "Follow Up":      { bg: "bg-orange-500/10", text: "text-orange-400" },
  "Delinquent":     { bg: "bg-orange-500/10", text: "text-orange-400" },
  "Legal Review":   { bg: "bg-red-500/10",    text: "text-red-300" },
  "Escalated":      { bg: "bg-red-500/10",    text: "text-red-400" },
  "Legal":          { bg: "bg-purple-500/10", text: "text-purple-400" },
  "Monitoring":     { bg: "bg-blue-500/10",   text: "text-blue-400" },
  "Payment Plan":   { bg: "bg-blue-500/10",   text: "text-blue-400" },
  "Resolved":       { bg: "bg-green-500/10",  text: "text-green-400" },
  "Hardship":       { bg: "bg-sky-500/10",    text: "text-sky-400" },
  "Written Off":    { bg: "bg-gray-500/10",   text: "text-gray-400" },
  "Vacate Pending": { bg: "bg-gray-500/10",   text: "text-gray-400" },
};

/**
 * Normalize raw collection status (DB enum or case-level string)
 * into a display label for the UI.
 */
export function normalizeCollectionStatus(status: string, arrearsDays?: number): string {
  // ARSnapshot / CollectionStatus enum values (uppercase)
  if (status === "CURRENT" || status === "LATE") return COLLECTION_DISPLAY_LABELS.CURRENT;
  if (status === "DELINQUENT") {
    if (arrearsDays != null && arrearsDays < 30)  return COLLECTION_DISPLAY_LABELS.LATE;
    if (arrearsDays != null && arrearsDays < 60)  return COLLECTION_DISPLAY_LABELS.FOLLOW_UP;
    if (arrearsDays != null && arrearsDays < 90)  return COLLECTION_DISPLAY_LABELS.LEGAL_REVIEW;
    if (arrearsDays != null && arrearsDays >= 90)  return COLLECTION_DISPLAY_LABELS.ESCALATED;
    return COLLECTION_DISPLAY_LABELS.DELINQUENT;
  }
  if (status === "CHRONIC") return COLLECTION_DISPLAY_LABELS.ESCALATED;

  // CollectionCase statuses (lowercase snake_case)
  if (status === "new_arrears" || status === "monitoring") return COLLECTION_DISPLAY_LABELS.MONITORING;
  if (status === "demand_sent") return COLLECTION_DISPLAY_LABELS.LEGAL_REVIEW;
  if (status === "legal_referred") return COLLECTION_DISPLAY_LABELS.LEGAL;
  if (status === "payment_plan") return COLLECTION_DISPLAY_LABELS.PAYMENT_PLAN;
  if (status === "resolved") return COLLECTION_DISPLAY_LABELS.RESOLVED;

  // DB enum values (uppercase)
  if (status === "PAYMENT_PLAN") return COLLECTION_DISPLAY_LABELS.PAYMENT_PLAN;
  if (status === "LEGAL") return COLLECTION_DISPLAY_LABELS.LEGAL;
  if (status === "HARDSHIP") return COLLECTION_DISPLAY_LABELS.HARDSHIP;
  if (status === "WRITTEN_OFF") return COLLECTION_DISPLAY_LABELS.WRITTEN_OFF;
  if (status === "VACATE_PENDING") return COLLECTION_DISPLAY_LABELS.VACATE_PENDING;

  return status.replace(/_/g, " ");
}

/**
 * Get the Tailwind bg + text color classes for a collection display label.
 */
export function getCollectionStatusColor(displayLabel: string): StatusStyle {
  return COLLECTION_STATUS_COLORS[displayLabel] ?? { bg: "bg-gray-500/10", text: "text-gray-400" };
}

// ── Collection case statuses (written to CollectionCase.status) ──

/** Canonical values for CollectionCase.status (plain String field, not enum). */
export const COLLECTION_CASE_STATUSES = [
  "monitoring",
  "demand_sent",
  "legal_referred",
  "payment_plan",
  "resolved",
] as const;

export type CollectionCaseStatus = (typeof COLLECTION_CASE_STATUSES)[number];

/** For use in UI filter dropdowns and select options */
export const COLLECTION_CASE_OPTIONS: Array<{ value: CollectionCaseStatus; label: string }> = [
  { value: "monitoring", label: "Monitoring" },
  { value: "demand_sent", label: "Demand Sent" },
  { value: "legal_referred", label: "Legal Referred" },
  { value: "payment_plan", label: "Payment Plan" },
  { value: "resolved", label: "Resolved" },
];

/**
 * Status options for the tenant profile page status selector.
 * These map DB enum values (ARSnapshot.collectionStatus) to display labels+colors.
 */
export const COLLECTION_PROFILE_STATUS_OPTIONS = [
  { dbValue: "CURRENT",      label: "Active",       ...COLLECTION_STATUS_COLORS["Active"] },
  { dbValue: "LATE",         label: "Late",          ...COLLECTION_STATUS_COLORS["Late"] },
  { dbValue: "DELINQUENT",   label: "Delinquent",    ...COLLECTION_STATUS_COLORS["Delinquent"] },
  { dbValue: "PAYMENT_PLAN", label: "Payment Plan",  ...COLLECTION_STATUS_COLORS["Payment Plan"] },
  { dbValue: "LEGAL",        label: "Legal",          ...COLLECTION_STATUS_COLORS["Legal"] },
  { dbValue: "HARDSHIP",     label: "Hardship",       ...COLLECTION_STATUS_COLORS["Hardship"] },
  { dbValue: "WRITTEN_OFF",  label: "Written Off",    ...COLLECTION_STATUS_COLORS["Written Off"] },
] as const;

// ── Legal stages ──────────────────────────────────────────────

export const LEGAL_STAGE_LABELS: Record<string, string> = {
  NOTICE_SENT: "Notice Sent",
  HOLDOVER: "Holdover",
  NONPAYMENT: "Nonpayment",
  COURT_DATE: "Court Date",
  STIPULATION: "Stipulation",
  JUDGMENT: "Judgment",
  WARRANT: "Warrant",
  EVICTION: "Eviction",
  SETTLED: "Settled",
};

export const LEGAL_STAGE_VARIANTS: Record<string, string> = {
  NOTICE_SENT: "blue",
  HOLDOVER: "orange",
  NONPAYMENT: "red",
  COURT_DATE: "purple",
  STIPULATION: "amber",
  JUDGMENT: "red",
  WARRANT: "red",
  EVICTION: "red",
  SETTLED: "green",
};

export function getLegalStageInfo(stage: string): { label: string; variant: string } {
  return {
    label: LEGAL_STAGE_LABELS[stage] || stage,
    variant: LEGAL_STAGE_VARIANTS[stage] || "gray",
  };
}

// ── Legal case status (separate from stage) ───────────────────

export const LEGAL_CASE_STATUSES = ["active", "settled", "dismissed", "withdrawn"] as const;
export type LegalCaseStatus = (typeof LEGAL_CASE_STATUSES)[number];

// ── Vacancy statuses ──────────────────────────────────────────

export const VACANCY_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  VACANT:        { label: "Vacant",         bg: "bg-white/5",        text: "text-text-dim" },
  PRE_TURNOVER:  { label: "Pre-Turnover",   bg: "bg-amber-500/10",   text: "text-amber-400" },
  TURNOVER:      { label: "Turnover",       bg: "bg-blue-500/10",    text: "text-blue-400" },
  READY_TO_SHOW: { label: "Ready to Show",  bg: "bg-teal-500/10",    text: "text-teal-400" },
  RENT_PROPOSED: { label: "Rent Proposed",  bg: "bg-amber-500/10",   text: "text-amber-400" },
  RENT_APPROVED: { label: "Rent Approved",  bg: "bg-green-500/10",   text: "text-green-400" },
  LISTED:        { label: "Listed",         bg: "bg-purple-500/10",  text: "text-purple-400" },
  LEASED:        { label: "Leased",         bg: "bg-accent/10",      text: "text-accent" },
  OCCUPIED:      { label: "Occupied",       bg: "bg-green-500/10",   text: "text-green-400" },
};

export function getVacancyStatusConfig(status: string) {
  return VACANCY_STATUS_CONFIG[status] || VACANCY_STATUS_CONFIG.VACANT;
}

// ── Signal severity ───────────────────────────────────────────

export const SIGNAL_SEVERITY_COLORS: Record<string, StatusStyle> = {
  low:      { bg: "bg-green-500/10",  text: "text-green-400" },
  medium:   { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  high:     { bg: "bg-orange-500/10", text: "text-orange-400" },
  critical: { bg: "bg-red-500/10",    text: "text-red-400" },
};

export function getSignalSeverityColor(severity: string): StatusStyle {
  return SIGNAL_SEVERITY_COLORS[severity] ?? SIGNAL_SEVERITY_COLORS.low;
}

// ── Arrears categories ────────────────────────────────────────

export const ARREARS_CATEGORY_CONFIG: Record<string, { label: string; variant: string }> = {
  current: { label: "Current",    variant: "green" },
  "30":    { label: "30 Days",    variant: "blue" },
  "60":    { label: "60 Days",    variant: "amber" },
  "90":    { label: "90 Days",    variant: "orange" },
  "120+":  { label: "120+ Days",  variant: "red" },
  vacant:  { label: "Vacant",     variant: "gray" },
};

export function getArrearsCategoryInfo(category: string): { label: string; variant: string } {
  return ARREARS_CATEGORY_CONFIG[category] || ARREARS_CATEGORY_CONFIG.current;
}

// ── Work order statuses ───────────────────────────────────────

export const WORK_ORDER_STATUS_COLORS: Record<string, StatusStyle> = {
  PENDING_REVIEW: { bg: "bg-gray-500/10",   text: "text-gray-400" },
  OPEN:           { bg: "bg-blue-500/10",    text: "text-blue-400" },
  IN_PROGRESS:    { bg: "bg-amber-500/10",   text: "text-amber-400" },
  ON_HOLD:        { bg: "bg-orange-500/10",  text: "text-orange-400" },
  COMPLETED:      { bg: "bg-green-500/10",   text: "text-green-400" },
};

export const WORK_ORDER_PRIORITY_COLORS: Record<string, StatusStyle> = {
  LOW:    { bg: "bg-blue-500/20",   text: "text-blue-400" },
  MEDIUM: { bg: "bg-amber-500/20",  text: "text-amber-400" },
  HIGH:   { bg: "bg-orange-500/20", text: "text-orange-400" },
  URGENT: { bg: "bg-red-500/20",    text: "text-red-400" },
};

// ── Compliance statuses ───────────────────────────────────────

export const COMPLIANCE_STATUS_COLORS: Record<string, StatusStyle> = {
  COMPLIANT:      { bg: "bg-green-500/10",  text: "text-green-400" },
  NON_COMPLIANT:  { bg: "bg-red-500/10",    text: "text-red-400" },
  PENDING:        { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  OVERDUE:        { bg: "bg-red-500/10",    text: "text-red-400" },
  SCHEDULED:      { bg: "bg-blue-500/10",   text: "text-blue-400" },
  NOT_APPLICABLE: { bg: "bg-gray-500/10",   text: "text-gray-400" },
};

// ── Violation lifecycle ───────────────────────────────────────

export const VIOLATION_LIFECYCLE_COLORS: Record<string, StatusStyle> = {
  INGESTED:            { bg: "bg-gray-500/10",   text: "text-gray-400" },
  TRIAGED:             { bg: "bg-blue-500/10",    text: "text-blue-400" },
  DISPATCHED:          { bg: "bg-purple-500/10",  text: "text-purple-400" },
  IN_REPAIR:           { bg: "bg-amber-500/10",   text: "text-amber-400" },
  EVIDENCE_PENDING:    { bg: "bg-orange-500/10",  text: "text-orange-400" },
  PM_VERIFIED:         { bg: "bg-green-500/10",   text: "text-green-400" },
  CERTIFICATION_READY: { bg: "bg-teal-500/10",    text: "text-teal-400" },
  CERTIFIED:           { bg: "bg-green-500/10",   text: "text-green-400" },
  REJECTED:            { bg: "bg-red-500/10",     text: "text-red-400" },
};

// ── Turnover statuses ─────────────────────────────────────────

export const TURNOVER_STATUS_COLORS: Record<string, StatusStyle> = {
  PENDING_INSPECTION: { bg: "bg-amber-500/20",  text: "text-amber-400" },
  INSPECTION_DONE:    { bg: "bg-blue-500/20",    text: "text-blue-400" },
  SCOPE_CREATED:      { bg: "bg-purple-500/20",  text: "text-purple-400" },
  VENDORS_ASSIGNED:   { bg: "bg-indigo-500/20",  text: "text-indigo-400" },
  READY_TO_LIST:      { bg: "bg-cyan-500/20",    text: "text-cyan-400" },
  LISTED:             { bg: "bg-green-500/20",   text: "text-green-400" },
  COMPLETE:           { bg: "bg-green-600/20",   text: "text-green-300" },
};

// ── Project statuses ──────────────────────────────────────────

export const PROJECT_STATUS_COLORS: Record<string, StatusStyle> = {
  PLANNED:                 { bg: "bg-gray-500/20",   text: "text-gray-400" },
  ESTIMATING:              { bg: "bg-blue-500/20",    text: "text-blue-400" },
  PENDING_APPROVAL:        { bg: "bg-yellow-500/20",  text: "text-yellow-400" },
  APPROVED:                { bg: "bg-teal-500/20",    text: "text-teal-400" },
  IN_PROGRESS:             { bg: "bg-blue-500/20",    text: "text-blue-400" },
  PAUSED:                  { bg: "bg-orange-500/20",  text: "text-orange-400" },
  SUBSTANTIALLY_COMPLETE:  { bg: "bg-purple-500/20",  text: "text-purple-400" },
  COMPLETED:               { bg: "bg-green-500/20",   text: "text-green-400" },
  CLOSED:                  { bg: "bg-gray-500/20",    text: "text-gray-400" },
  CANCELLED:               { bg: "bg-red-500/20",     text: "text-red-400" },
};

export const PROJECT_PRIORITY_COLORS: Record<string, StatusStyle> = {
  CRITICAL: { bg: "bg-red-500/20",   text: "text-red-400" },
  HIGH:     { bg: "bg-orange-500/20", text: "text-orange-400" },
  MEDIUM:   { bg: "bg-blue-500/20",   text: "text-blue-400" },
  LOW:      { bg: "bg-gray-500/20",   text: "text-gray-400" },
};

export const PROJECT_HEALTH_COLORS: Record<string, { hex: string; text: string }> = {
  ON_TRACK:    { hex: "#22c55e", text: "text-green-400" },
  AT_RISK:     { hex: "#f59e0b", text: "text-orange-400" },
  DELAYED:     { hex: "#ef4444", text: "text-red-400" },
  OVER_BUDGET: { hex: "#ef4444", text: "text-red-400" },
  BLOCKED:     { hex: "#7c3aed", text: "text-purple-400" },
};
