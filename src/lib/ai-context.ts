import { prisma } from "@/lib/prisma";

function fmt$(n: number | any): string {
  return "$" + Math.abs(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "N/A";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function buildPortfolioContext(user: any, tenantId?: string): Promise<string> {
  const sections: string[] = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  // If tenant-specific, build focused context
  if (tenantId) {
    return buildTenantContext(tenantId);
  }

  // Role-based building filter
  const buildingWhere: any = {};
  if (user.role !== "ADMIN" && user.assignedProperties?.length) {
    buildingWhere.id = { in: user.assignedProperties };
  }

  // 1. Buildings overview
  const buildings = await prisma.building.findMany({
    where: buildingWhere,
    include: {
      units: { include: { tenant: { select: { id: true, balance: true, marketRent: true } } } },
      _count: { select: { units: true } },
    },
    orderBy: { address: "asc" },
  });

  const buildingSummary = buildings.map((b) => {
    const occupied = b.units.filter((u) => !u.isVacant).length;
    const vacant = b.units.filter((u) => u.isVacant).length;
    const totalBalance = b.units.reduce((s, u) => s + Number(u.tenant?.balance ?? 0), 0);
    const totalRent = b.units.reduce((s, u) => s + Number(u.tenant?.marketRent ?? 0), 0);
    return `  - ${b.address}: ${b._count.units} units (${occupied} occupied, ${vacant} vacant), Total balance: ${fmt$(totalBalance)}, Monthly rent roll: ${fmt$(totalRent)}`;
  }).join("\n");

  sections.push(`BUILDINGS (${buildings.length}):\n${buildingSummary}`);

  // 2. All tenants with balances
  const unitWhere: any = {};
  if (user.role !== "ADMIN" && user.assignedProperties?.length) {
    unitWhere.unit = { buildingId: { in: user.assignedProperties } };
  }

  const tenants = await prisma.tenant.findMany({
    where: unitWhere,
    include: {
      unit: { include: { building: { select: { address: true } } } },
      legalCase: { select: { inLegal: true, stage: true, caseNumber: true, attorney: true } },
      _count: { select: { notes: true, payments: true } },
    },
    orderBy: { balance: "desc" },
  });

  const totalBalance = tenants.reduce((s, t) => s + Number(t.balance), 0);
  const totalRent = tenants.reduce((s, t) => s + Number(t.marketRent), 0);
  const inArrears = tenants.filter((t) => Number(t.balance) > 0);

  sections.push(`PORTFOLIO SUMMARY:\n  Total tenants: ${tenants.length}\n  Total outstanding balance: ${fmt$(totalBalance)}\n  Total monthly rent roll: ${fmt$(totalRent)}\n  Tenants in arrears: ${inArrears.length}`);

  // Top 30 tenants by balance (most useful for AI)
  const topTenants = tenants.slice(0, 30).map((t) => {
    const balance = Number(t.balance);
    const rent = Number(t.marketRent);
    const monthsOwed = rent > 0 ? (balance / rent).toFixed(1) : "N/A";
    const legal = t.legalCase ? `IN LEGAL (${t.legalCase.stage}, Case: ${t.legalCase.caseNumber || "pending"}, Attorney: ${t.legalCase.attorney || "unassigned"})` : "No legal";
    return `  - ${t.name} | Unit ${t.unit.unitNumber} @ ${t.unit.building.address} | Balance: ${fmt$(balance)} | Rent: ${fmt$(rent)} | ${monthsOwed} months owed | Score: ${t.collectionScore} | Arrears: ${t.arrearsCategory} (${t.arrearsDays} days) | Lease: ${t.leaseStatus} (exp: ${fmtDate(t.leaseExpiration)}) | ${legal} | Notes: ${t._count.notes}, Payments: ${t._count.payments}`;
  }).join("\n");

  sections.push(`TOP TENANTS BY BALANCE:\n${topTenants}`);

  // 3. Recent notes (last 30 days)
  const recentNotes = await prisma.tenantNote.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { tenant: { unit: { buildingId: { in: user.assignedProperties } } } }
        : {}),
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
      `  - [${fmtDate(n.createdAt)}] ${n.tenant.name} (${n.tenant.unit.unitNumber} @ ${n.tenant.unit.building.address}) - ${n.category}: "${n.text.slice(0, 200)}" — by ${n.author.name}`
    ).join("\n");
    sections.push(`RECENT NOTES (last 30 days, ${recentNotes.length}):\n${notesText}`);
  }

  // 4. Active legal cases
  const legalCases = await prisma.legalCase.findMany({
    where: {
      inLegal: true,
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { tenant: { unit: { buildingId: { in: user.assignedProperties } } } }
        : {}),
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
      return `  - ${c.tenant.name} (${c.tenant.unit.unitNumber} @ ${c.tenant.unit.building.address}) | Stage: ${c.stage} | Case#: ${c.caseNumber || "pending"} | Attorney: ${c.attorney || "unassigned"} | Balance: ${fmt$(Number(c.tenant.balance))} | Filed: ${fmtDate(c.filedDate)} | Last note: ${lastNote ? `[${fmtDate(lastNote.createdAt)}] "${lastNote.text.slice(0, 100)}"` : "None"}`;
    }).join("\n");
    sections.push(`ACTIVE LEGAL CASES (${legalCases.length}):\n${legalText}`);
  }

  // 5. Vacancies
  const vacantUnits = await prisma.unit.findMany({
    where: {
      isVacant: true,
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { buildingId: { in: user.assignedProperties } }
        : {}),
    },
    include: {
      building: { select: { address: true } },
      vacancyInfo: true,
    },
  });

  if (vacantUnits.length > 0) {
    const vacText = vacantUnits.map((u) =>
      `  - Unit ${u.unitNumber} @ ${u.building.address} | Condition: ${u.vacancyInfo?.condition || "Unknown"} | Proposed rent: ${u.vacancyInfo?.proposedRent ? fmt$(Number(u.vacancyInfo.proposedRent)) : "Not set"} | Ready: ${u.vacancyInfo?.readyDate ? fmtDate(u.vacancyInfo.readyDate) : "TBD"}`
    ).join("\n");
    sections.push(`VACANT UNITS (${vacantUnits.length}):\n${vacText}`);
  }

  // 6. Recent payments (last 30 days)
  const recentPayments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { tenant: { unit: { buildingId: { in: user.assignedProperties } } } }
        : {}),
    },
    include: {
      tenant: { select: { name: true, unit: { select: { unitNumber: true, building: { select: { address: true } } } } } },
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  if (recentPayments.length > 0) {
    const payText = recentPayments.map((p) =>
      `  - [${fmtDate(p.date)}] ${p.tenant.name} (${p.tenant.unit.unitNumber} @ ${p.tenant.unit.building.address}): ${fmt$(Number(p.amount))} via ${p.method || "unknown"}`
    ).join("\n");
    sections.push(`RECENT PAYMENTS (last 30 days, ${recentPayments.length}):\n${payText}`);
  }

  // 7. Lease expirations coming up (next 90 days)
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 86400000);
  const expiringLeases = await prisma.tenant.findMany({
    where: {
      leaseExpiration: { lte: ninetyDaysFromNow, gte: now },
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { unit: { buildingId: { in: user.assignedProperties } } }
        : {}),
    },
    include: {
      unit: { include: { building: { select: { address: true } } } },
    },
    orderBy: { leaseExpiration: "asc" },
  });

  if (expiringLeases.length > 0) {
    const leaseText = expiringLeases.map((t) => {
      const daysLeft = Math.ceil((t.leaseExpiration!.getTime() - now.getTime()) / 86400000);
      return `  - ${t.name} (${t.unit.unitNumber} @ ${t.unit.building.address}) | Expires: ${fmtDate(t.leaseExpiration)} (${daysLeft} days) | Rent: ${fmt$(Number(t.marketRent))} | Balance: ${fmt$(Number(t.balance))}`;
    }).join("\n");
    sections.push(`LEASES EXPIRING WITHIN 90 DAYS (${expiringLeases.length}):\n${leaseText}`);
  }

  // 8. Open work orders
  const openWOs = await prisma.workOrder.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { buildingId: { in: user.assignedProperties } }
        : {}),
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
      ...(user.role !== "ADMIN" && user.assignedProperties?.length
        ? { tenant: { unit: { buildingId: { in: user.assignedProperties } } } }
        : {}),
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

  sections.push(`\nToday's date: ${fmtDate(now)}\nUser: ${user.name} (${user.role})`);

  return sections.join("\n\n");
}

async function buildTenantContext(tenantId: string): Promise<string> {
  const sections: string[] = [];
  const now = new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      unit: { include: { building: true } },
      legalCase: { include: { notes: { orderBy: { createdAt: "desc" }, take: 10, include: { author: { select: { name: true } } } } } },
      notes: { orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true } } } },
      payments: { orderBy: { date: "desc" }, take: 15 },
      commLogs: { orderBy: { createdAt: "desc" }, take: 10, include: { author: { select: { name: true } } } },
      tasks: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!tenant) return "Tenant not found.";

  const balance = Number(tenant.balance);
  const rent = Number(tenant.marketRent);
  const monthsOwed = rent > 0 ? (balance / rent).toFixed(1) : "0";

  sections.push(`TENANT PROFILE:
  Name: ${tenant.name}
  Unit: ${tenant.unit.unitNumber} @ ${tenant.unit.building.address}
  Email: ${tenant.email || "None"} | Phone: ${tenant.phone || "None"}
  Balance: ${fmt$(balance)} | Market Rent: ${fmt$(rent)} | Months owed: ${monthsOwed}
  Legal Rent: ${fmt$(Number(tenant.legalRent))} | Pref Rent: ${fmt$(Number(tenant.prefRent))}
  Deposit: ${fmt$(Number(tenant.deposit))}
  Arrears: ${tenant.arrearsCategory} (${tenant.arrearsDays} days)
  Collection Score: ${tenant.collectionScore}/100
  Lease: ${tenant.leaseStatus} | Expires: ${fmtDate(tenant.leaseExpiration)}
  Move-in: ${fmtDate(tenant.moveInDate)} | Stabilized: ${tenant.isStabilized ? "Yes" : "No"}
  Charge Code: ${tenant.chargeCode || "None"}`);

  if (tenant.legalCase) {
    const lc = tenant.legalCase;
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
      `  [${fmtDate(p.date)}] ${fmt$(Number(p.amount))} via ${p.method || "unknown"} (ref: ${p.reference || "none"})`
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
