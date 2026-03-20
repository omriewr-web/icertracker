import { prisma } from "@/lib/prisma";
import { getBuildingIdScope, getTenantScope, canAccessBuilding, EMPTY_SCOPE } from "@/lib/data-scope";

interface AiUser {
  role: string;
  name?: string;
  assignedProperties?: string[] | null;
  organizationId?: string | null;
}

function fmt$(n: number | any): string {
  return "$" + Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function buildPortfolioContext(user: AiUser, tenantId?: string): Promise<string> {
  const sections: string[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  // If tenant-specific, build focused context (with access check)
  if (tenantId) {
    return buildTenantContext(user, tenantId);
  }

  // Use shared data-scope helpers for building filter
  const buildingScope = getBuildingIdScope(user);
  if (buildingScope === EMPTY_SCOPE) {
    return `No buildings accessible for user ${user.name || "unknown"} (${user.role}).`;
  }
  const buildingWhere = buildingScope as Record<string, unknown>;

  const tenantScope = getTenantScope(user);
  const tenantWhere = tenantScope === EMPTY_SCOPE ? { id: "__none__" } : (tenantScope as Record<string, unknown>);

  // 1. Buildings overview
  const buildings = await prisma.building.findMany({
    where: buildingWhere,
    include: {
      units: { include: { tenant: { select: { id: true, balance: true, marketRent: true } } } },
      _count: { select: { units: true } },
    },
    orderBy: { address: "asc" },
  });

  const buildingIds = buildings.map((b) => b.id);

  const buildingSummary = buildings.map((b) => {
    const occupied = b.units.filter((u) => !u.isVacant).length;
    const vacant = b.units.filter((u) => u.isVacant).length;
    const totalBalance = b.units.reduce((s, u) => s + (u.tenant?.balance?.toNumber() ?? 0), 0);
    const totalRent = b.units.reduce((s, u) => s + (u.tenant?.marketRent?.toNumber() ?? 0), 0);
    return `  - ${b.address}: ${b._count.units} units (${occupied} occupied, ${vacant} vacant), Total balance: ${fmt$(totalBalance)}, Monthly rent roll: ${fmt$(totalRent)}`;
  }).join("\n");

  sections.push(`BUILDINGS (${buildings.length}):\n${buildingSummary}`);

  // 2. All tenants with balances
  const tenants = await prisma.tenant.findMany({
    where: tenantWhere,
    include: {
      unit: { include: { building: { select: { address: true } } } },
      legalCases: { where: { isActive: true }, select: { inLegal: true, stage: true, caseNumber: true, attorney: true }, take: 1 },
      _count: { select: { notes: true, payments: true } },
    },
    orderBy: { balance: "desc" },
  });

  const totalBalance = tenants.reduce((s, t) => s + (t.balance?.toNumber() ?? 0), 0);
  const totalRent = tenants.reduce((s, t) => s + (t.marketRent?.toNumber() ?? 0), 0);
  const inArrears = tenants.filter((t) => (t.balance?.toNumber() ?? 0) > 0);

  sections.push(`PORTFOLIO SUMMARY:\n  Total tenants: ${tenants.length}\n  Total outstanding balance: ${fmt$(totalBalance)}\n  Total monthly rent roll: ${fmt$(totalRent)}\n  Tenants in arrears: ${inArrears.length}`);

  // Top 30 tenants by balance (most useful for AI)
  const topTenants = tenants.slice(0, 30).map((t) => {
    const balance = t.balance?.toNumber() ?? 0;
    const rent = t.marketRent?.toNumber() ?? 0;
    const monthsOwed = rent > 0 ? (balance / rent).toFixed(1) : "N/A";
    const lc = t.legalCases?.[0];
    const legal = lc ? `IN LEGAL (${lc.stage}, Case: ${lc.caseNumber || "pending"}, Attorney: ${lc.attorney || "unassigned"})` : "No legal";
    return `  - ${t.name} | Unit ${t.unit.unitNumber} @ ${t.unit.building?.address || ""} | Balance: ${fmt$(balance)} | Rent: ${fmt$(rent)} | ${monthsOwed} months owed | Score: ${t.collectionScore} | Arrears: ${t.arrearsCategory} (${t.arrearsDays} days) | Lease: ${t.leaseStatus} (exp: ${fmtDate(t.leaseExpiration)}) | ${legal} | Notes: ${t._count.notes}, Payments: ${t._count.payments}`;
  }).join("\n");

  sections.push(`TOP TENANTS BY BALANCE:\n${topTenants}`);

  // 3. Recent notes (last 30 days)
  const recentNotes = await prisma.tenantNote.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      tenant: tenantWhere,
    },
    include: {
      tenant: { select: { name: true, unit: { select: { unitNumber: true, building: { select: { address: true } } } } } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (recentNotes.length > 0) {
    const notesText = recentNotes.map((n) =>
      `  - [${fmtDate(n.createdAt)}] ${n.tenant.name} (${n.tenant.unit.unitNumber} @ ${n.tenant.unit.building?.address || ""}) - ${n.category}: "${n.text.slice(0, 200)}" — by ${n.author.name}`
    ).join("\n");
    sections.push(`RECENT NOTES (last 30 days, ${recentNotes.length}):\n${notesText}`);
  }

  // 4. Active legal cases
  const legalCases = await prisma.legalCase.findMany({
    where: {
      inLegal: true,
      tenant: tenantWhere,
    },
    include: {
      tenant: {
        select: {
          name: true, balance: true, marketRent: true, arrearsDays: true,
          unit: { select: { unitNumber: true, building: { select: { address: true } } } },
        },
      },
      notes: { orderBy: { createdAt: "desc" }, take: 2, include: { author: { select: { name: true } } } },
    },
  });

  if (legalCases.length > 0) {
    const legalText = legalCases.map((c) => {
      const lastNote = c.notes[0];
      return `  - ${c.tenant.name} (${c.tenant.unit.unitNumber} @ ${c.tenant.unit.building?.address || ""}) | Stage: ${c.stage} | Case#: ${c.caseNumber || "pending"} | Attorney: ${c.attorney || "unassigned"} | Balance: ${fmt$(c.tenant.balance?.toNumber() ?? 0)} | Filed: ${fmtDate(c.filedDate)} | Last note: ${lastNote ? `[${fmtDate(lastNote.createdAt)}] "${lastNote.text.slice(0, 100)}"` : "None"}`;
    }).join("\n");
    sections.push(`ACTIVE LEGAL CASES (${legalCases.length}):\n${legalText}`);
  }

  // 5. Vacancies
  const vacantUnits = await prisma.unit.findMany({
    where: {
      isVacant: true,
      buildingId: { in: buildingIds },
    },
    include: {
      building: { select: { address: true } },
      vacancyInfo: true,
    },
  });

  if (vacantUnits.length > 0) {
    const vacText = vacantUnits.map((u) =>
      `  - Unit ${u.unitNumber} @ ${u.building.address} | Condition: ${u.vacancyInfo?.condition || "Unknown"} | Proposed rent: ${u.vacancyInfo?.proposedRent ? fmt$(u.vacancyInfo.proposedRent.toNumber()) : "Not set"} | Ready: ${u.vacancyInfo?.readyDate ? fmtDate(u.vacancyInfo.readyDate) : "TBD"}`
    ).join("\n");
    sections.push(`VACANT UNITS (${vacantUnits.length}):\n${vacText}`);
  }

  // 6. Recent payments (last 30 days)
  const recentPayments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      tenant: tenantWhere,
    },
    include: {
      tenant: { select: { name: true, unit: { select: { unitNumber: true, building: { select: { address: true } } } } } },
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  if (recentPayments.length > 0) {
    const payText = recentPayments.map((p) =>
      `  - [${fmtDate(p.date)}] ${p.tenant.name} (${p.tenant.unit.unitNumber} @ ${p.tenant.unit.building?.address || ""}): ${fmt$(p.amount?.toNumber() ?? 0)} via ${p.method || "unknown"}`
    ).join("\n");
    sections.push(`RECENT PAYMENTS (last 30 days, ${recentPayments.length}):\n${payText}`);
  }

  // 7. Lease expirations coming up (next 90 days)
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 86400000);
  const expiringLeases = await prisma.tenant.findMany({
    where: {
      leaseExpiration: { lte: ninetyDaysFromNow, gte: now },
      ...tenantWhere,
    },
    include: {
      unit: { include: { building: { select: { address: true } } } },
    },
    orderBy: { leaseExpiration: "asc" },
  });

  if (expiringLeases.length > 0) {
    const leaseText = expiringLeases.map((t) => {
      const daysLeft = Math.ceil((t.leaseExpiration!.getTime() - now.getTime()) / 86400000);
      return `  - ${t.name} (${t.unit.unitNumber} @ ${t.unit.building?.address || ""}) | Expires: ${fmtDate(t.leaseExpiration)} (${daysLeft} days) | Rent: ${fmt$(t.marketRent?.toNumber() ?? 0)} | Balance: ${fmt$(t.balance?.toNumber() ?? 0)}`;
    }).join("\n");
    sections.push(`LEASES EXPIRING WITHIN 90 DAYS (${expiringLeases.length}):\n${leaseText}`);
  }

  // 8. Open work orders
  const openWOs = await prisma.workOrder.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      buildingId: { in: buildingIds },
    },
    include: {
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
      tenant: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (openWOs.length > 0) {
    const woText = openWOs.map((w) =>
      `  - [${w.priority}] ${w.title} @ ${w.building.address}${w.unit ? ` Unit ${w.unit.unitNumber}` : ""} | Status: ${w.status} | Category: ${w.category} | Created: ${fmtDate(w.createdAt)}`
    ).join("\n");
    sections.push(`OPEN WORK ORDERS (${openWOs.length}):\n${woText}`);
  }

  // 9. Communication logs (last 14 days)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
  const commLogs = await prisma.commLog.findMany({
    where: {
      createdAt: { gte: fourteenDaysAgo },
      tenant: tenantWhere,
    },
    include: {
      tenant: { select: { name: true } },
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  if (commLogs.length > 0) {
    const commText = commLogs.map((c) =>
      `  - [${fmtDate(c.createdAt)}] ${c.tenant.name} - ${c.type}: "${c.summary.slice(0, 150)}" (${c.outcome || "no outcome"}) — by ${c.author.name}`
    ).join("\n");
    sections.push(`RECENT COMMUNICATIONS (last 14 days, ${commLogs.length}):\n${commText}`);
  }

  sections.push(`\nToday's date: ${fmtDate(now)}\nUser: ${user.name || "unknown"} (${user.role})`);

  return sections.join("\n\n");
}

async function buildTenantContext(user: AiUser, tenantId: string): Promise<string> {
  // Verify user can access this tenant before loading data
  const tenantCheck = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { unit: { select: { buildingId: true } } },
  });
  if (!tenantCheck) return "Tenant not found.";
  if (!(await canAccessBuilding(user, tenantCheck.unit.buildingId))) {
    return "Access denied: you do not have permission to view this tenant.";
  }

  const sections: string[] = [];
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: { include: { building: true } },
      legalCases: { where: { isActive: true }, take: 1, include: { notes: { orderBy: { createdAt: "desc" }, take: 10, include: { author: { select: { name: true } } } } } },
      notes: { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true } } } },
      payments: { orderBy: { date: "desc" }, take: 15 },
      commLogs: { orderBy: { createdAt: "desc" }, take: 10, include: { author: { select: { name: true } } } },
      tasks: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!tenant) return "Tenant not found.";

  const balance = tenant.balance?.toNumber() ?? 0;
  const rent = tenant.marketRent?.toNumber() ?? 0;
  const monthsOwed = rent > 0 ? (balance / rent).toFixed(1) : "0";

  sections.push(`TENANT PROFILE:
  Name: ${tenant.name}
  Unit: ${tenant.unit.unitNumber} @ ${tenant.unit.building?.address || ""}
  Email: ${tenant.email || "None"} | Phone: ${tenant.phone || "None"}
  Balance: ${fmt$(balance)} | Market Rent: ${fmt$(rent)} | Months owed: ${monthsOwed}
  Legal Rent: ${fmt$(tenant.legalRent?.toNumber() ?? 0)} | Pref Rent: ${fmt$(tenant.prefRent?.toNumber() ?? 0)}
  Deposit: ${fmt$(tenant.deposit?.toNumber() ?? 0)}
  Arrears: ${tenant.arrearsCategory} (${tenant.arrearsDays} days)
  Collection Score: ${tenant.collectionScore}/100
  Lease: ${tenant.leaseStatus} | Expires: ${fmtDate(tenant.leaseExpiration)}
  Move-in: ${fmtDate(tenant.moveInDate)} | Stabilized: ${tenant.isStabilized ? "Yes" : "No"}
  Charge Code: ${tenant.chargeCode || "None"}`);

  if (tenant.legalCases?.[0]) {
    const lc = tenant.legalCases[0];
    const legalNotes = lc.notes.map((n) =>
      `    [${fmtDate(n.createdAt)}] ${n.stage}: "${n.text.slice(0, 200)}" — ${n.author.name}`
    ).join("\n");
    sections.push(`LEGAL CASE:
  Status: ${lc.inLegal ? "ACTIVE" : "Closed"} | Stage: ${lc.stage}
  Case#: ${lc.caseNumber || "Pending"} | Attorney: ${lc.attorney || "Unassigned"}
  Filed: ${fmtDate(lc.filedDate)}
  Legal Notes:\n${legalNotes || "    None"}`);
  }

  if (tenant.notes.length > 0) {
    const notesText = tenant.notes.map((n) =>
      `  [${fmtDate(n.createdAt)}] ${n.category}: "${n.text.slice(0, 200)}" — ${n.author.name}`
    ).join("\n");
    sections.push(`NOTES (${tenant.notes.length} most recent):\n${notesText}`);
  }

  if (tenant.payments.length > 0) {
    const payText = tenant.payments.map((p) =>
      `  [${fmtDate(p.date)}] ${fmt$(p.amount?.toNumber() ?? 0)} via ${p.method || "unknown"} (ref: ${p.reference || "none"})`
    ).join("\n");
    sections.push(`PAYMENT HISTORY (${tenant.payments.length} most recent):\n${payText}`);
  }

  if (tenant.commLogs.length > 0) {
    const commText = tenant.commLogs.map((c) =>
      `  [${fmtDate(c.createdAt)}] ${c.type}: "${c.summary.slice(0, 200)}" — ${c.author.name} | Outcome: ${c.outcome || "none"}`
    ).join("\n");
    sections.push(`COMMUNICATION HISTORY (${tenant.commLogs.length} most recent):\n${commText}`);
  }

  if (tenant.tasks.length > 0) {
    const taskText = tenant.tasks.map((t) =>
      `  [${t.done ? "DONE" : "OPEN"}] ${t.type}: ${t.description} | Due: ${fmtDate(t.dueDate)}`
    ).join("\n");
    sections.push(`TASKS:\n${taskText}`);
  }

  sections.push(`\nToday's date: ${fmtDate(now)}`);
  return sections.join("\n\n");
}
