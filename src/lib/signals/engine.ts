import { prisma } from "@/lib/prisma";

// ── Types ───────────────────────────────────────────────────────

export interface DetectedSignal {
  deduplicationKey: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  buildingId?: string;
  tenantId?: string;
  recommendedAction: string;
}

export interface ScanResult {
  created: number;
  updated: number;
  resolved: number;
  total: number;
  durationMs: number;
}

// ── Main Scan Function ──────────────────────────────────────────

export async function runSignalScan(
  scanType: "manual" | "scheduled" = "manual",
  triggeredById?: string
): Promise<ScanResult> {
  const start = Date.now();
  const log = await prisma.signalScanLog.create({
    data: { scanType, triggeredById, startedAt: new Date() },
  });

  try {
    // Run all detection rules in parallel
    const results = await Promise.allSettled([
      detectCollectionRisks(),
      detectLegalEscalations(),
      detectVacancyRisks(),
      detectViolationRisks(),
      detectMaintenanceFailures(),
      detectLeaseRisks(),
      detectUtilityRisks(),
      detectViolationWithoutWorkOrder(),
      detectComplaintWithoutWorkOrder(),
      detectCompletedWorkNotCertified(),
      detectOccupiedUnitMissingLease(),
      detectRecurringIssuePattern(),
      detectLegalCaseStale(),
    ]);

    // Collect all detected signals
    const detected: DetectedSignal[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") detected.push(...r.value);
    }

    // Build set of all detected dedup keys
    const detectedKeys = new Set(detected.map((s) => s.deduplicationKey));

    // Upsert all detected signals
    let created = 0;
    let updated = 0;

    for (const signal of detected) {
      const existing = await prisma.operationalSignal.findUnique({
        where: { deduplicationKey: signal.deduplicationKey },
      });

      if (!existing) {
        await prisma.operationalSignal.create({
          data: {
            ...signal,
            status: "active",
            lastTriggeredAt: new Date(),
          },
        });
        created++;
      } else if (existing.status === "resolved") {
        // Re-open resolved signal if condition recurs
        await prisma.operationalSignal.update({
          where: { id: existing.id },
          data: {
            status: "active",
            severity: signal.severity,
            title: signal.title,
            description: signal.description,
            recommendedAction: signal.recommendedAction,
            lastTriggeredAt: new Date(),
            resolvedAt: null,
          },
        });
        created++;
      } else {
        // Update lastTriggeredAt + possibly severity
        await prisma.operationalSignal.update({
          where: { id: existing.id },
          data: {
            lastTriggeredAt: new Date(),
            severity: signal.severity,
            title: signal.title,
            description: signal.description,
            recommendedAction: signal.recommendedAction,
          },
        });
        updated++;
      }
    }

    // Resolve signals whose conditions no longer apply
    const activeSignals = await prisma.operationalSignal.findMany({
      where: { status: { in: ["active", "acknowledged"] } },
      select: { id: true, deduplicationKey: true },
    });

    let resolved = 0;
    for (const s of activeSignals) {
      if (!detectedKeys.has(s.deduplicationKey)) {
        await prisma.operationalSignal.update({
          where: { id: s.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });
        resolved++;
      }
    }

    const durationMs = Date.now() - start;
    await prisma.signalScanLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        durationMs,
        success: true,
        createdSignals: created,
        updatedSignals: updated,
        resolvedSignals: resolved,
      },
    });

    return { created, updated, resolved, total: detected.length, durationMs };
  } catch (err: any) {
    await prisma.signalScanLog.update({
      where: { id: log.id },
      data: {
        completedAt: new Date(),
        durationMs: Date.now() - start,
        success: false,
        errorMessage: err.message || "Unknown error",
      },
    });
    throw err;
  }
}

// ── Detection: Collection Risks ─────────────────────────────────

async function detectCollectionRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  // Tenants with high balance and no recent notes
  const tenants = await prisma.tenant.findMany({
    where: { balance: { gt: 0 } },
    select: {
      id: true,
      name: true,
      balance: true,
      marketRent: true,
      monthsOwed: true,
      unit: {
        select: {
          buildingId: true,
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
      notes: {
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { id: true },
        take: 1,
      },
      legalCase: { select: { id: true, inLegal: true } },
    },
  });

  for (const t of tenants) {
    const balance = Number(t.balance);
    const rent = Number(t.marketRent);
    const monthsOwed = Number(t.monthsOwed);
    const hasRecentNote = t.notes.length > 0;
    const hasLegalCase = t.legalCase?.inLegal === true;

    // CRITICAL: balance > 4 months rent AND no legal case
    if (monthsOwed > 4 && !hasLegalCase) {
      signals.push({
        deduplicationKey: `collections-risk-critical-${t.id}`,
        type: "collections_risk",
        severity: "critical",
        title: `${t.name} owes ${monthsOwed.toFixed(1)} months — no legal case`,
        description: `Balance: $${balance.toLocaleString()} at ${t.unit.building.address} #${t.unit.unitNumber}. Rent: $${rent.toLocaleString()}/mo. No legal case filed.`,
        entityType: "tenant",
        entityId: t.id,
        buildingId: t.unit.buildingId,
        tenantId: t.id,
        recommendedAction: "Serve rent demand. Balance exceeds 4 months.",
      });
    }

    // HIGH: balance > 2 months rent AND no note in 14 days
    if (monthsOwed > 2 && !hasRecentNote) {
      signals.push({
        deduplicationKey: `collections-risk-high-${t.id}`,
        type: "collections_risk",
        severity: "high",
        title: `${t.name} — no follow-up in 14+ days`,
        description: `Balance: $${balance.toLocaleString()} (${monthsOwed.toFixed(1)} months) at ${t.unit.building.address} #${t.unit.unitNumber}. No notes in 14 days.`,
        entityType: "tenant",
        entityId: t.id,
        buildingId: t.unit.buildingId,
        tenantId: t.id,
        recommendedAction: "Call tenant and log follow-up note within 48 hours.",
      });
    }
  }

  return signals;
}

// ── Detection: Legal Escalations ────────────────────────────────

async function detectLegalEscalations(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // CRITICAL: Tenant balance > $10k AND no legal case
  const highBalanceTenants = await prisma.tenant.findMany({
    where: {
      balance: { gte: 10000 },
      legalCase: null,
    },
    select: {
      id: true,
      name: true,
      balance: true,
      unit: {
        select: {
          buildingId: true,
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const t of highBalanceTenants) {
    signals.push({
      deduplicationKey: `legal-no-case-${t.id}`,
      type: "legal_escalation",
      severity: "critical",
      title: `${t.name} — $${Number(t.balance).toLocaleString()} balance, no legal case`,
      description: `At ${t.unit.building.address} #${t.unit.unitNumber}. Balance exceeds $10,000 threshold for legal referral.`,
      entityType: "tenant",
      entityId: t.id,
      buildingId: t.unit.buildingId,
      tenantId: t.id,
      recommendedAction: "Refer to legal counsel. Balance exceeds $10,000 threshold.",
    });
  }

  // HIGH: Court date within 7 days
  const upcomingCourt = await prisma.legalCase.findMany({
    where: {
      inLegal: true,
      courtDate: { gte: now, lte: sevenDaysFromNow },
    },
    select: {
      id: true,
      courtDate: true,
      stage: true,
      tenant: {
        select: {
          id: true,
          name: true,
          unit: {
            select: {
              buildingId: true,
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  for (const c of upcomingCourt) {
    const daysUntil = Math.ceil((c.courtDate!.getTime() - now.getTime()) / 86400000);
    signals.push({
      deduplicationKey: `legal-court-soon-${c.id}`,
      type: "legal_escalation",
      severity: "high",
      title: `Court date in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${c.tenant.name}`,
      description: `${c.stage} hearing at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Prepare court documents. Confirm attorney attendance.",
    });
  }

  // MEDIUM: Legal case with no activity in 30 days
  const staleCases = await prisma.legalCase.findMany({
    where: {
      inLegal: true,
      updatedAt: { lt: thirtyDaysAgo },
    },
    select: {
      id: true,
      stage: true,
      updatedAt: true,
      tenant: {
        select: {
          id: true,
          name: true,
          unit: {
            select: {
              buildingId: true,
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  for (const c of staleCases) {
    const daysSince = Math.ceil((now.getTime() - c.updatedAt.getTime()) / 86400000);
    signals.push({
      deduplicationKey: `legal-stale-${c.id}`,
      type: "legal_escalation",
      severity: "medium",
      title: `Legal case stale ${daysSince} days — ${c.tenant.name}`,
      description: `${c.stage} case at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}. No updates in ${daysSince} days.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Contact attorney for case status update.",
    });
  }

  return signals;
}

// ── Detection: Vacancy Risks ────────────────────────────────────

async function detectVacancyRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();

  // Find active vacancies
  const vacancies = await prisma.vacancy.findMany({
    where: { isActive: true },
    select: {
      id: true,
      createdAt: true,
      unit: {
        select: {
          id: true,
          unitNumber: true,
          buildingId: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const v of vacancies) {
    const daysSince = Math.ceil((now.getTime() - v.createdAt.getTime()) / 86400000);

    let severity: "low" | "medium" | "high" | "critical";
    if (daysSince >= 90) severity = "critical";
    else if (daysSince >= 60) severity = "high";
    else if (daysSince >= 30) severity = "medium";
    else continue; // Skip < 30 days

    signals.push({
      deduplicationKey: `vacancy-${severity}-${v.unit.id}`,
      type: "vacancy_risk",
      severity,
      title: `Unit vacant ${daysSince} days — ${v.unit.building.address} #${v.unit.unitNumber}`,
      description: `Vacant since ${v.createdAt.toLocaleDateString()}. ${daysSince >= 90 ? "Critical revenue loss." : daysSince >= 60 ? "Extended vacancy, needs attention." : "Monitor turnover progress."}`,
      entityType: "unit",
      entityId: v.unit.id,
      buildingId: v.unit.buildingId,
      recommendedAction: daysSince >= 90 ? "Inspect unit. Vacant 90+ days, no turnover scope." : daysSince >= 60 ? "Expedite turnover. Review marketing and broker assignment." : "Check turnover progress and broker showings.",
    });
  }

  return signals;
}

// ── Detection: Violation Risks ──────────────────────────────────

async function detectViolationRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();

  // Class C violations open > 10 days
  const classC = await prisma.violation.findMany({
    where: {
      isOpen: true,
      class: "C",
    },
    select: {
      id: true,
      description: true,
      issuedDate: true,
      inspectionDate: true,
      buildingId: true,
      unitNumber: true,
      building: { select: { address: true } },
    },
  });

  for (const v of classC) {
    const refDate = v.issuedDate || v.inspectionDate || new Date();
    const daysOpen = Math.ceil((now.getTime() - refDate.getTime()) / 86400000);

    if (daysOpen >= 30) {
      signals.push({
        deduplicationKey: `violation-c-critical-${v.id}`,
        type: "violation_risk",
        severity: "critical",
        title: `Class C violation open ${daysOpen} days`,
        description: `${v.building.address}${v.unitNumber ? ` #${v.unitNumber}` : ""}. ${v.description.substring(0, 150)}`,
        entityType: "violation",
        entityId: v.id,
        buildingId: v.buildingId,
        recommendedAction: "Create work order. Class C open 30+ days.",
      });
    } else if (daysOpen >= 10) {
      signals.push({
        deduplicationKey: `violation-c-high-${v.id}`,
        type: "violation_risk",
        severity: "high",
        title: `Class C violation open ${daysOpen} days`,
        description: `${v.building.address}${v.unitNumber ? ` #${v.unitNumber}` : ""}. ${v.description.substring(0, 150)}`,
        entityType: "violation",
        entityId: v.id,
        buildingId: v.buildingId,
        recommendedAction: "Schedule repair. Class C violation must be corrected promptly.",
      });
    }
  }

  // Buildings with >10 open violations
  const buildingCounts = await prisma.violation.groupBy({
    by: ["buildingId"],
    where: { isOpen: true },
    _count: { id: true },
    having: { id: { _count: { gt: 10 } } },
  });

  if (buildingCounts.length > 0) {
    const bcBuildings = await prisma.building.findMany({
      where: { id: { in: buildingCounts.map((bc) => bc.buildingId) } },
      select: { id: true, address: true },
    });
    const bcMap = new Map(bcBuildings.map((b) => [b.id, b.address]));

    for (const bc of buildingCounts) {
      const address = bcMap.get(bc.buildingId) || "Unknown";
      signals.push({
        deduplicationKey: `violation-building-${bc.buildingId}`,
        type: "violation_risk",
        severity: "medium",
        title: `${bc._count.id} open violations — ${address}`,
        description: `Building has ${bc._count.id} open violations. Review and prioritize remediation.`,
        entityType: "building",
        entityId: bc.buildingId,
        buildingId: bc.buildingId,
        recommendedAction: "Review and prioritize violation remediation plan.",
      });
    }
  }

  // AEP buildings
  const aepBuildings = await prisma.building.findMany({
    where: {
      aepStatus: { not: "none" },
    },
    select: { id: true, address: true, aepStatus: true },
  });

  for (const b of aepBuildings) {
    signals.push({
      deduplicationKey: `aep-${b.id}`,
      type: "violation_risk",
      severity: "critical",
      title: `AEP building — ${b.address}`,
      description: `Building is in the Alternative Enforcement Program (${b.aepStatus}). Requires immediate compliance attention.`,
      entityType: "building",
      entityId: b.id,
      buildingId: b.id,
      recommendedAction: "Engage compliance consultant. AEP requires immediate corrective action plan.",
    });
  }

  return signals;
}

// ── Detection: Maintenance Failures ─────────────────────────────

async function detectMaintenanceFailures(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // Open work orders
  const openWOs = await prisma.workOrder.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      createdAt: true,
      buildingId: true,
      unitId: true,
      tenantId: true,
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
      tenant: { select: { name: true } },
    },
  });

  for (const wo of openWOs) {
    const daysOpen = Math.ceil((now.getTime() - wo.createdAt.getTime()) / 86400000);
    const location = `${wo.building.address}${wo.unit ? ` #${wo.unit.unitNumber}` : ""}`;

    // CRITICAL: Emergency not completed within 24h
    if (wo.priority === "URGENT" && wo.createdAt < oneDayAgo) {
      signals.push({
        deduplicationKey: `workorder-urgent-${wo.id}`,
        type: "maintenance_failure",
        severity: "critical",
        title: `Urgent work order ${daysOpen}d overdue — ${location}`,
        description: `"${wo.title}" at ${location}${wo.tenant ? ` (${wo.tenant.name})` : ""}. Urgent work order not resolved within 24 hours.`,
        entityType: "workorder",
        entityId: wo.id,
        buildingId: wo.buildingId,
        tenantId: wo.tenantId || undefined,
        recommendedAction: "Escalate. Urgent work order unresolved 24+ hours.",
      });
      continue;
    }

    // HIGH: Open > 30 days
    if (daysOpen >= 30) {
      signals.push({
        deduplicationKey: `workorder-overdue-high-${wo.id}`,
        type: "maintenance_failure",
        severity: "high",
        title: `Work order open ${daysOpen} days — ${location}`,
        description: `"${wo.title}" at ${location}${wo.tenant ? ` (${wo.tenant.name})` : ""}.`,
        entityType: "workorder",
        entityId: wo.id,
        buildingId: wo.buildingId,
        tenantId: wo.tenantId || undefined,
        recommendedAction: "Reassign or escalate. Work order stalled 30+ days.",
      });
    }
    // MEDIUM: Open > 14 days
    else if (daysOpen >= 14) {
      signals.push({
        deduplicationKey: `workorder-overdue-medium-${wo.id}`,
        type: "maintenance_failure",
        severity: "medium",
        title: `Work order open ${daysOpen} days — ${location}`,
        description: `"${wo.title}" at ${location}${wo.tenant ? ` (${wo.tenant.name})` : ""}.`,
        entityType: "workorder",
        entityId: wo.id,
        buildingId: wo.buildingId,
        tenantId: wo.tenantId || undefined,
        recommendedAction: "Follow up with assigned vendor or staff.",
      });
    }
  }

  return signals;
}

// ── Detection: Lease Risks ──────────────────────────────────────

async function detectLeaseRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

  const expiringTenants = await prisma.tenant.findMany({
    where: {
      leaseExpiration: { gte: now, lte: sixtyDaysFromNow },
      leaseStatus: { in: ["active", "expiring-soon"] },
    },
    select: {
      id: true,
      name: true,
      leaseExpiration: true,
      unit: {
        select: {
          buildingId: true,
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const t of expiringTenants) {
    const daysUntil = Math.ceil((t.leaseExpiration!.getTime() - now.getTime()) / 86400000);

    if (daysUntil <= 30) {
      signals.push({
        deduplicationKey: `lease-expiring-high-${t.id}`,
        type: "lease_expiration",
        severity: "high",
        title: `Lease expires in ${daysUntil} days — ${t.name}`,
        description: `At ${t.unit.building.address} #${t.unit.unitNumber}. Lease expires ${t.leaseExpiration!.toLocaleDateString()}.`,
        entityType: "tenant",
        entityId: t.id,
        buildingId: t.unit.buildingId,
        tenantId: t.id,
        recommendedAction: `Send renewal outreach. Lease expires in ${daysUntil} days.`,
      });
    } else {
      signals.push({
        deduplicationKey: `lease-expiring-medium-${t.id}`,
        type: "lease_expiration",
        severity: "medium",
        title: `Lease expires in ${daysUntil} days — ${t.name}`,
        description: `At ${t.unit.building.address} #${t.unit.unitNumber}. Lease expires ${t.leaseExpiration!.toLocaleDateString()}.`,
        entityType: "tenant",
        entityId: t.id,
        buildingId: t.unit.buildingId,
        tenantId: t.id,
        recommendedAction: `Prepare renewal offer. Lease expires in ${daysUntil} days.`,
      });
    }
  }

  return signals;
}

// ── Detection: Utility Risks ────────────────────────────────────

async function detectUtilityRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  // Meters assigned to units with tenants but no active account
  const metersWithoutAccounts = await prisma.utilityMeter.findMany({
    where: {
      unitId: { not: null },
      accounts: { none: { status: "active" } },
    },
    select: {
      id: true,
      utilityType: true,
      buildingId: true,
      unit: {
        select: {
          unitNumber: true,
          isVacant: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const m of metersWithoutAccounts) {
    if (m.unit && !m.unit.isVacant) {
      signals.push({
        deduplicationKey: `utility-unassigned-${m.id}`,
        type: "utility_problem",
        severity: "medium",
        title: `${m.utilityType} meter — no active account`,
        description: `${m.unit.building.address} #${m.unit.unitNumber}. Occupied unit has a ${m.utilityType} meter with no active utility account.`,
        entityType: "meter",
        entityId: m.id,
        buildingId: m.buildingId,
        recommendedAction: "Contact utility provider to activate account.",
      });
    }
  }

  return signals;
}

// ── Detection: Violation Without Work Order ─────────────────────

async function detectViolationWithoutWorkOrder(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const violations = await prisma.violation.findMany({
    where: {
      isOpen: true,
      linkedWorkOrderId: null,
      needsWorkOrder: true,
    },
    select: {
      id: true,
      class: true,
      description: true,
      buildingId: true,
      unitNumber: true,
      building: { select: { address: true } },
    },
  });

  for (const v of violations) {
    const severity = v.class === "C" ? "high" : v.class === "B" ? "medium" : "low";
    signals.push({
      deduplicationKey: `violation-no-wo-${v.id}`,
      type: "violation_risk",
      severity,
      title: `Open violation, no work order — ${v.building.address}${v.unitNumber ? ` #${v.unitNumber}` : ""}`,
      description: `Class ${v.class || "?"} violation with no linked work order. ${v.description.substring(0, 120)}`,
      entityType: "violation",
      entityId: v.id,
      buildingId: v.buildingId,
      recommendedAction: `Create work order for Class ${v.class || "?"} violation.`,
    });
  }

  return signals;
}

// ── Detection: Complaint Without Work Order ─────────────────────

async function detectComplaintWithoutWorkOrder(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const complaints = await prisma.complaint.findMany({
    where: {
      status: "OPEN",
      violations: { none: { linkedWorkOrderId: { not: null } } },
    },
    select: {
      id: true,
      category: true,
      description: true,
      buildingId: true,
      reportedDate: true,
      unit: { select: { unitNumber: true } },
      building: { select: { address: true } },
    },
  });

  for (const c of complaints) {
    signals.push({
      deduplicationKey: `complaint-no-wo-${c.id}`,
      type: "violation_risk",
      severity: "medium",
      title: `Open complaint, no work order — ${c.building.address}${c.unit?.unitNumber ? ` #${c.unit.unitNumber}` : ""}`,
      description: `${c.category} complaint. ${c.description.substring(0, 120)}`,
      entityType: "complaint",
      entityId: c.id,
      buildingId: c.buildingId,
      recommendedAction: "Create work order to address tenant complaint.",
    });
  }

  return signals;
}

// ── Detection: Completed Work Order, Violation Still Open ───────

async function detectCompletedWorkNotCertified(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const violations = await prisma.violation.findMany({
    where: {
      isOpen: true,
      linkedWorkOrderId: { not: null },
      linkedWorkOrder: { status: "COMPLETED" },
    },
    select: {
      id: true,
      class: true,
      description: true,
      buildingId: true,
      unitNumber: true,
      linkedWorkOrderId: true,
      building: { select: { address: true } },
    },
  });

  for (const v of violations) {
    signals.push({
      deduplicationKey: `wo-done-violation-open-${v.id}`,
      type: "violation_risk",
      severity: "high",
      title: `Work complete but violation still open — ${v.building.address}${v.unitNumber ? ` #${v.unitNumber}` : ""}`,
      description: `Work order completed but Class ${v.class || "?"} violation remains open. Certification may be needed.`,
      entityType: "violation",
      entityId: v.id,
      buildingId: v.buildingId,
      recommendedAction: "File certification of correction with issuing agency.",
    });
  }

  return signals;
}

// ── Detection: Occupied Unit Missing Lease ──────────────────────

async function detectOccupiedUnitMissingLease(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  // Tenants with expired or no lease
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { leaseStatus: "expired" },
        { leaseExpiration: { lt: new Date() }, leaseStatus: { not: "month-to-month" } },
      ],
    },
    select: {
      id: true,
      name: true,
      leaseStatus: true,
      leaseExpiration: true,
      unit: {
        select: {
          id: true,
          unitNumber: true,
          isVacant: true,
          buildingId: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const t of tenants) {
    if (t.unit.isVacant) continue;
    signals.push({
      deduplicationKey: `no-active-lease-${t.id}`,
      type: "lease_expiration",
      severity: "high",
      title: `No active lease — ${t.name}`,
      description: `${t.unit.building.address} #${t.unit.unitNumber}. Lease status: ${t.leaseStatus}. ${t.leaseExpiration ? `Expired ${t.leaseExpiration.toLocaleDateString()}.` : "No lease on file."}`,
      entityType: "tenant",
      entityId: t.id,
      buildingId: t.unit.buildingId,
      tenantId: t.id,
      recommendedAction: "Issue new lease or convert to month-to-month agreement.",
    });
  }

  return signals;
}

// ── Detection: Recurring Issue Pattern ──────────────────────────

async function detectRecurringIssuePattern(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Complaints per unit in last 90 days
  const complaintCounts = await prisma.complaint.groupBy({
    by: ["unitId"],
    where: {
      unitId: { not: null },
      createdAt: { gte: ninetyDaysAgo },
    },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
  });

  if (complaintCounts.length > 0) {
    const unitIds = complaintCounts.filter((c) => c.unitId != null).map((c) => c.unitId as string);
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true, unitNumber: true, buildingId: true, building: { select: { address: true } } },
    });
    const unitMap = new Map(units.map((u) => [u.id, u]));

    for (const cc of complaintCounts) {
      if (!cc.unitId) continue;
      const unit = unitMap.get(cc.unitId);
      if (!unit) continue;
      signals.push({
        deduplicationKey: `recurring-complaints-${cc.unitId}`,
        type: "violation_risk",
        severity: "high",
        title: `${cc._count.id} complaints in 90 days — ${unit.building.address} #${unit.unitNumber}`,
        description: `Unit has ${cc._count.id} complaints in the last 90 days. Investigate systemic issue.`,
        entityType: "unit",
        entityId: cc.unitId,
        buildingId: unit.buildingId,
        recommendedAction: "Schedule building inspection. Investigate root cause of repeat complaints.",
      });
    }
  }

  // Also check violations per building in last 90 days
  const violationCounts = await prisma.violation.groupBy({
    by: ["buildingId"],
    where: {
      isOpen: true,
      createdAt: { gte: ninetyDaysAgo },
    },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
  });

  // This overlaps with the existing >10 violations detector, so only flag at unit level above
  // Building-level recurring is already covered by detectViolationRisks

  return signals;
}

// ── Detection: Legal Case Stale (Extended) ──────────────────────

async function detectLegalCaseStale(): Promise<DetectedSignal[]> {
  // NOTE: This detector extends the existing stale case detection in detectLegalEscalations.
  // detectLegalEscalations already handles stale cases (30+ days, medium severity).
  // This function intentionally returns empty to avoid duplicate signals.
  // The stale case logic lives in detectLegalEscalations with dedup key "legal-stale-{caseId}".
  return [];
}
