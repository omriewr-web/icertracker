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
      detectCourtDatePassedNoUpdate(),
      detectWarrantNoMarshal(),
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
      detectVacantUnitWithoutTurnover(),
      detectTurnoverStalled(),
      detectOverdueWorkOrders(),
      detectAdvancedCaseMissingAttorney(),
      detectLegalCaseUnassigned(),
      detectCollectionsNoRecentNote(),
      detectCollectionsLegalCandidateNoCase(),
      detectCollectionsPaymentPlanOverdue(),
      detectLeaseExpiringNoAskingRent(),
      detectVacancyNoLeasingActivity(),
      detectLeaseExpiringSoonNoRenewal(),
      detectProjectRisks(),
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
      legalCases: { where: { isActive: true }, select: { inLegal: true }, take: 1 },
    },
  });

  for (const t of tenants) {
    const balance = Number(t.balance);
    const rent = Number(t.marketRent);
    const monthsOwed = Number(t.monthsOwed);
    const hasRecentNote = t.notes.length > 0;
    const hasLegalCase = t.legalCases[0]?.inLegal === true;

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

  // CRITICAL: Tenant balance > $10k AND no active legal case
  const highBalanceTenants = await prisma.tenant.findMany({
    where: {
      balance: { gte: 10000 },
      legalCases: { none: { isActive: true } },
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
      isActive: true,
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
    const courtDateStr = c.courtDate!.toISOString().split("T")[0];
    signals.push({
      deduplicationKey: `court-date-${c.id}-${courtDateStr}`,
      type: "legal_escalation",
      severity: "high",
      title: `Court date in ${daysUntil} day${daysUntil !== 1 ? "s" : ""} — ${c.tenant.name}`,
      description: `${c.stage} hearing at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: `Court date in ${daysUntil} days. Confirm attorney attendance and prepare documents.`,
    });
  }

  // MEDIUM: Legal case with no activity in 30 days (not SETTLED)
  const staleCases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      stage: { not: "SETTLED" },
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

  // Vacant unit with tenant-assigned active account
  const vacantTenantAccounts = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: "tenant",
      meter: {
        isActive: true,
        unit: { isVacant: true },
      },
    },
    select: {
      id: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of vacantTenantAccounts) {
    if (acc.meter.unit) {
      signals.push({
        deduplicationKey: `utility-vacant-tenant-${acc.id}`,
        type: "utility_problem",
        severity: "medium",
        title: `${acc.meter.utilityType} — tenant account on vacant unit`,
        description: `${acc.meter.unit.building.address} #${acc.meter.unit.unitNumber}. Unit is vacant but still has an active tenant utility account.`,
        entityType: "meter",
        entityId: acc.meter.id,
        buildingId: acc.meter.buildingId,
        recommendedAction: "Unit vacant. Transfer or close tenant utility account.",
      });
    }
  }

  // Occupied unit where owner/management pays
  const ownerPaidOccupied = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: { in: ["owner", "management"] },
      meter: {
        isActive: true,
        unit: {
          isVacant: false,
          tenant: { isNot: null },
        },
      },
    },
    select: {
      id: true,
      assignedPartyType: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of ownerPaidOccupied) {
    if (acc.meter.unit) {
      signals.push({
        deduplicationKey: `utility-owner-paid-${acc.id}`,
        type: "utility_problem",
        severity: "low",
        title: `${acc.meter.utilityType} — ${acc.assignedPartyType} paying on occupied unit`,
        description: `${acc.meter.unit.building.address} #${acc.meter.unit.unitNumber}. Occupied unit has utility paid by ${acc.assignedPartyType}.`,
        entityType: "meter",
        entityId: acc.meter.id,
        buildingId: acc.meter.buildingId,
        recommendedAction: "Owner paying utility on occupied unit. Verify this is intentional.",
      });
    }
  }

  // Active accounts with no check for current month
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const accountsMissingCheck = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      meter: { isActive: true },
      monthlyChecks: {
        none: {
          month: currentMonth,
          year: currentYear,
        },
      },
    },
    select: {
      id: true,
      accountNumber: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const acc of accountsMissingCheck) {
    const unitLabel = acc.meter.unit ? ` #${acc.meter.unit.unitNumber}` : " (common)";
    const addr = acc.meter.unit?.building.address || acc.meter.building.address;
    signals.push({
      deduplicationKey: `utility-no-check-${acc.id}-${currentYear}-${currentMonth}`,
      type: "utility_problem",
      severity: "medium",
      title: `${acc.meter.utilityType} — no check recorded this month`,
      description: `${addr}${unitLabel}. Active account has no utility check recorded for ${currentMonth}/${currentYear}.`,
      entityType: "meter",
      entityId: acc.meter.id,
      buildingId: acc.meter.buildingId,
      recommendedAction: "No utility check recorded for this month.",
    });
  }

  // Transfer needed — tenant moved out but still on utility account
  const movedOutTenantAccounts = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: "tenant",
      meter: {
        isActive: true,
        unit: {
          tenant: {
            moveOutDate: { lt: now },
          },
        },
      },
    },
    select: {
      id: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
              tenant: { select: { name: true, moveOutDate: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of movedOutTenantAccounts) {
    if (acc.meter.unit?.tenant) {
      const t = acc.meter.unit.tenant;
      const addr = acc.meter.unit.building.address;
      const unit = acc.meter.unit.unitNumber;
      signals.push({
        deduplicationKey: `utility-transfer-moved-out-${acc.id}`,
        type: "utility_problem",
        severity: "high",
        title: `${acc.meter.utilityType} — tenant moved out, transfer needed`,
        description: `${addr} #${unit}. Tenant "${t.name}" moved out but still has an active ${acc.meter.utilityType} utility account.`,
        entityType: "meter",
        entityId: acc.meter.id,
        buildingId: acc.meter.buildingId,
        recommendedAction: `Tenant ${t.name} moved out from unit #${unit}. Transfer utility account to owner immediately.`,
      });
    }
  }

  // Transfer needed — lease expired but tenant still on utility account (not yet moved out)
  const leaseExpiredTenantAccounts = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: "tenant",
      meter: {
        isActive: true,
        unit: {
          tenant: {
            leaseExpiration: { lt: now },
            OR: [
              { moveOutDate: null },
              { moveOutDate: { gte: now } },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
              tenant: { select: { name: true, leaseExpiration: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of leaseExpiredTenantAccounts) {
    if (acc.meter.unit?.tenant) {
      const t = acc.meter.unit.tenant;
      const addr = acc.meter.unit.building.address;
      const unit = acc.meter.unit.unitNumber;
      signals.push({
        deduplicationKey: `utility-transfer-lease-expired-${acc.id}`,
        type: "utility_problem",
        severity: "high",
        title: `${acc.meter.utilityType} — lease expired, review transfer`,
        description: `${addr} #${unit}. Tenant "${t.name}" lease expired but still has an active ${acc.meter.utilityType} utility account.`,
        entityType: "meter",
        entityId: acc.meter.id,
        buildingId: acc.meter.buildingId,
        recommendedAction: `Lease expired for ${t.name} in unit #${unit}. Review and transfer utility account to owner.`,
      });
    }
  }

  // Tenant moving out within 7 days, still has active tenant utility account
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
  const moveoutPendingAccounts = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: "tenant",
      meter: {
        isActive: true,
        unit: {
          tenant: {
            moveOutDate: {
              gte: now,
              lte: sevenDaysFromNow,
            },
          },
        },
      },
    },
    select: {
      id: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
              tenant: { select: { name: true, moveOutDate: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of moveoutPendingAccounts) {
    if (acc.meter.unit?.tenant?.moveOutDate) {
      const t = acc.meter.unit.tenant;
      const addr = acc.meter.unit.building.address;
      const unit = acc.meter.unit.unitNumber;
      const daysLeft = Math.ceil((new Date(t.moveOutDate!).getTime() - now.getTime()) / 86400000);
      signals.push({
        deduplicationKey: `utility-moveout-pending-${acc.id}`,
        type: "utility_problem",
        severity: "medium",
        title: `${acc.meter.utilityType} — tenant moving out in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        description: `${addr} #${unit}. Tenant "${t.name}" moving out in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} but still has an active ${acc.meter.utilityType} utility account.`,
        entityType: "meter",
        entityId: acc.meter.id,
        buildingId: acc.meter.buildingId,
        recommendedAction: `Tenant ${t.name} moving out in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} from unit #${unit}. Schedule utility account transfer.`,
      });
    }
  }

  // Meter missing unit link — unit-specific types (electric/gas/water) without unitId
  const metersWithoutUnit = await prisma.utilityMeter.findMany({
    where: {
      isActive: true,
      unitId: null,
      utilityType: { in: ["electric", "gas", "water"] },
    },
    select: {
      id: true,
      utilityType: true,
      buildingId: true,
      building: { select: { address: true } },
    },
  });

  for (const m of metersWithoutUnit) {
    signals.push({
      deduplicationKey: `utility-missing-unit-${m.id}`,
      type: "utility_problem",
      severity: "low",
      title: `${m.utilityType} meter — no unit linked`,
      description: `${m.building.address}. ${m.utilityType} meter has no unit assigned. This meter type typically serves a specific unit.`,
      entityType: "meter",
      entityId: m.id,
      buildingId: m.buildingId,
      recommendedAction: "Link this meter to the correct unit for accurate tracking.",
    });
  }

  // Vacant unit with active utility not held by owner/management
  const vacantNonOwnerAccounts = await prisma.utilityAccount.findMany({
    where: {
      status: "active",
      assignedPartyType: { notIn: ["owner", "management"] },
      meter: {
        isActive: true,
        unit: {
          isVacant: true,
        },
      },
    },
    select: {
      id: true,
      assignedPartyType: true,
      meter: {
        select: {
          id: true,
          utilityType: true,
          buildingId: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  for (const acc of vacantNonOwnerAccounts) {
    if (acc.meter.unit) {
      // Only add if not already flagged by vacant_tenant_account (avoid duplication for tenant accounts)
      if (acc.assignedPartyType !== "tenant") {
        signals.push({
          deduplicationKey: `utility-vacant-owner-hold-${acc.id}`,
          type: "utility_problem",
          severity: "medium",
          title: `${acc.meter.utilityType} — vacant unit, owner should hold account`,
          description: `${acc.meter.unit.building.address} #${acc.meter.unit.unitNumber}. Vacant unit has utility account assigned to "${acc.assignedPartyType}". Owner/management should hold account during vacancy.`,
          entityType: "meter",
          entityId: acc.meter.id,
          buildingId: acc.meter.buildingId,
          recommendedAction: "Transfer utility account to owner/management during vacancy.",
        });
      }
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
      type: "maintenance_failure",
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

// ── Detection: Overdue Work Orders ──────────────────────────────

async function detectOverdueWorkOrders(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();

  const overdueOrders = await prisma.workOrder.findMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ["COMPLETED"] },
    },
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      buildingId: true,
      building: { select: { address: true } },
      unit: { select: { unitNumber: true } },
    },
  });

  for (const wo of overdueOrders) {
    const severity = wo.priority === "URGENT" || wo.priority === "HIGH" ? "high" : "medium";
    const unitLabel = wo.unit?.unitNumber ? ` #${wo.unit.unitNumber}` : "";
    signals.push({
      deduplicationKey: `wo-overdue-${wo.id}`,
      type: "maintenance_failure",
      severity,
      title: `Work order overdue — ${wo.building.address}${unitLabel}`,
      description: `"${wo.title}" was due ${wo.dueDate!.toISOString().split("T")[0]} and is not yet completed.`,
      entityType: "work_order",
      entityId: wo.id,
      buildingId: wo.buildingId,
      recommendedAction: "Work order overdue. Reassign or escalate immediately.",
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
  // Stale case logic lives in detectLegalEscalations with dedup key "legal-stale-{caseId}".
  return [];
}

// ── Detection: Court Date Passed Without Stage Update ────────────

async function detectCourtDatePassedNoUpdate(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      courtDate: { lt: now },
      stage: "COURT_DATE",
    },
    select: {
      id: true,
      courtDate: true,
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

  for (const c of cases) {
    signals.push({
      deduplicationKey: `court-passed-${c.id}`,
      type: "legal_escalation",
      severity: "high",
      title: `Court date passed, no stage update — ${c.tenant.name}`,
      description: `Court date was ${c.courtDate!.toISOString().split("T")[0]} at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}. Stage is still COURT_DATE.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Court date has passed with no stage update. Record outcome and advance stage.",
    });
  }

  return signals;
}

// ── Detection: Warrant Stage Without Marshal Assigned ────────────

async function detectWarrantNoMarshal(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      stage: "WARRANT",
      marshalId: null,
      updatedAt: { lt: threeDaysAgo },
    },
    select: {
      id: true,
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

  for (const c of cases) {
    const daysAtStage = Math.ceil((now.getTime() - c.updatedAt.getTime()) / 86400000);
    signals.push({
      deduplicationKey: `warrant-marshal-${c.id}`,
      type: "legal_escalation",
      severity: "medium",
      title: `Warrant stage ${daysAtStage} days, no marshal — ${c.tenant.name}`,
      description: `Case at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber} has been at WARRANT stage for ${daysAtStage} days with no marshal assigned.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Case at warrant stage. Assign marshal to schedule execution.",
    });
  }

  return signals;
}

// ── Detection: Advanced Case Without Attorney ───────────────

async function detectAdvancedCaseMissingAttorney(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const advancedStages: string[] = ["COURT_DATE", "STIPULATION", "JUDGMENT", "WARRANT", "EVICTION"];

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      stage: { in: advancedStages as any },
      attorneyId: null,
      attorney: null,
    },
    select: {
      id: true,
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

  for (const c of cases) {
    signals.push({
      deduplicationKey: `legal-no-attorney-${c.id}`,
      type: "legal_escalation",
      severity: "high",
      title: `No attorney on ${c.stage.replace(/_/g, " ")} case — ${c.tenant.name}`,
      description: `Legal case at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber} is at ${c.stage.replace(/_/g, " ")} stage with no attorney assigned.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Advanced legal case has no attorney assigned. Assign counsel immediately.",
    });
  }

  return signals;
}

// ── Detection: Legal Case Without Assigned User ─────────────

async function detectLegalCaseUnassigned(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const cases = await prisma.legalCase.findMany({
    where: {
      isActive: true,
      inLegal: true,
      assignedUserId: null,
    },
    select: {
      id: true,
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

  for (const c of cases) {
    signals.push({
      deduplicationKey: `legal-unassigned-${c.id}`,
      type: "legal_escalation",
      severity: "medium",
      title: `Legal case unassigned — ${c.tenant.name}`,
      description: `${c.stage.replace(/_/g, " ")} case at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber} has no internal owner.`,
      entityType: "tenant",
      entityId: c.tenant.id,
      buildingId: c.tenant.unit.buildingId,
      tenantId: c.tenant.id,
      recommendedAction: "Legal case has no internal owner. Assign a responsible user.",
    });
  }

  return signals;
}

// ── Detection: Vacant Unit Without Turnover ──────────────────

async function detectVacantUnitWithoutTurnover(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Vacant units with no active turnover workflow
  const vacancies = await prisma.vacancy.findMany({
    where: { isActive: true, createdAt: { lte: twoDaysAgo } },
    select: {
      id: true,
      createdAt: true,
      unitId: true,
      unit: {
        select: {
          id: true,
          unitNumber: true,
          buildingId: true,
          building: { select: { address: true } },
          turnoverWorkflows: {
            where: { isActive: true },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  for (const v of vacancies) {
    if (v.unit.turnoverWorkflows.length > 0) continue;
    const daysVacant = Math.ceil((now.getTime() - v.createdAt.getTime()) / 86400000);

    signals.push({
      deduplicationKey: `vacant-no-turnover-${v.unit.id}`,
      type: "vacancy_risk",
      severity: "medium",
      title: `Vacant ${daysVacant} days, no turnover started — ${v.unit.building.address} #${v.unit.unitNumber}`,
      description: `Unit has been vacant for ${daysVacant} days with no turnover workflow created.`,
      entityType: "unit",
      entityId: v.unit.id,
      buildingId: v.unit.buildingId,
      recommendedAction: `Unit vacant ${daysVacant} days with no turnover started. Create turnover workflow.`,
    });
  }

  return signals;
}

// ── Detection: Turnover Stalled ──────────────────────────────

async function detectTurnoverStalled(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Active turnovers not updated in 7+ days and not complete
  const turnovers = await prisma.turnoverWorkflow.findMany({
    where: {
      isActive: true,
      status: { not: "COMPLETE" },
      updatedAt: { lte: sevenDaysAgo },
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
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

  for (const t of turnovers) {
    const daysSinceUpdate = Math.ceil((now.getTime() - t.updatedAt.getTime()) / 86400000);
    const statusLabel = t.status.replace(/_/g, " ").toLowerCase();

    signals.push({
      deduplicationKey: `turnover-stalled-${t.id}`,
      type: "vacancy_risk",
      severity: "high",
      title: `Turnover stalled ${daysSinceUpdate} days — ${t.unit.building.address} #${t.unit.unitNumber}`,
      description: `Turnover workflow stuck at "${statusLabel}" for ${daysSinceUpdate} days.`,
      entityType: "unit",
      entityId: t.unit.id,
      buildingId: t.unit.buildingId,
      recommendedAction: `Turnover stalled at ${statusLabel} for ${daysSinceUpdate} days. Review and advance.`,
    });
  }

  return signals;
}

// ── Detection: Collections — No Recent Note ─────────────────────

async function detectCollectionsNoRecentNote(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cases = await prisma.collectionCase.findMany({
    where: { isActive: true },
    select: {
      id: true,
      tenantId: true,
      buildingId: true,
      tenant: {
        select: {
          name: true,
          balance: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  const tenantIds = cases.map((c) => c.tenantId);
  const recentNotes = tenantIds.length > 0
    ? await prisma.collectionNote.findMany({
        where: { tenantId: { in: tenantIds }, createdAt: { gte: thirtyDaysAgo } },
        distinct: ["tenantId"],
        select: { tenantId: true },
      })
    : [];
  const notedSet = new Set(recentNotes.map((n) => n.tenantId));

  for (const c of cases) {
    if (Number(c.tenant.balance) <= 0) continue;
    if (notedSet.has(c.tenantId)) continue;

    signals.push({
      deduplicationKey: `coll-stale-${c.tenantId}`,
      type: "collections_risk",
      severity: "medium",
      title: `${c.tenant.name} — no collection activity in 30+ days`,
      description: `Balance: $${Number(c.tenant.balance).toLocaleString()} at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}. No collection note in 30+ days.`,
      entityType: "tenant",
      entityId: c.tenantId,
      buildingId: c.buildingId,
      tenantId: c.tenantId,
      recommendedAction: "No collection activity in 30+ days. Add a note or escalate status.",
    });
  }

  return signals;
}

// ── Detection: Collections — Legal Candidate No Case ────────────

async function detectCollectionsLegalCandidateNoCase(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const tenants = await prisma.tenant.findMany({
    where: {
      collectionScore: { gte: 40 },
      balance: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      balance: true,
      collectionScore: true,
      collectionCases: {
        where: { isActive: true },
        take: 1,
        select: { status: true },
      },
      legalCases: {
        where: { isActive: true },
        select: { isActive: true },
        take: 1,
      },
      unit: {
        select: {
          buildingId: true,
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  for (const t of tenants) {
    if (t.legalCases[0]?.isActive === true) continue;
    const caseStatus = t.collectionCases[0]?.status;
    if (caseStatus === "legal_referred") continue;

    signals.push({
      deduplicationKey: `coll-legal-${t.id}`,
      type: "collections_risk",
      severity: "high",
      title: `${t.name} — meets legal referral threshold (score: ${t.collectionScore})`,
      description: `Balance: $${Number(t.balance).toLocaleString()} at ${t.unit.building.address} #${t.unit.unitNumber}. Collection score: ${t.collectionScore}.`,
      entityType: "tenant",
      entityId: t.id,
      buildingId: t.unit.buildingId,
      tenantId: t.id,
      recommendedAction: "Tenant meets legal referral threshold. Review and refer to legal if appropriate.",
    });
  }

  return signals;
}

// ── Detection: Collections — Payment Plan Overdue ───────────────

async function detectCollectionsPaymentPlanOverdue(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cases = await prisma.collectionCase.findMany({
    where: { isActive: true, status: "payment_plan" },
    select: {
      tenantId: true,
      buildingId: true,
      tenant: {
        select: {
          name: true,
          balance: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
        },
      },
    },
  });

  if (cases.length === 0) return signals;

  const tenantIds = cases.map((c) => c.tenantId);
  const oldSnapshots = await prisma.aRSnapshot.findMany({
    where: {
      tenantId: { in: tenantIds },
      snapshotDate: { lte: thirtyDaysAgo },
    },
    orderBy: { snapshotDate: "desc" },
    distinct: ["tenantId"],
    select: { tenantId: true, totalBalance: true },
  });
  const snapshotMap = new Map(oldSnapshots.map((s) => [s.tenantId, Number(s.totalBalance)]));

  for (const c of cases) {
    const currentBalance = Number(c.tenant.balance);
    const oldBalance = snapshotMap.get(c.tenantId);
    if (oldBalance == null) continue;
    if (currentBalance >= oldBalance) {
      signals.push({
        deduplicationKey: `coll-plan-${c.tenantId}`,
        type: "collections_risk",
        severity: "high",
        title: `${c.tenant.name} — payment plan shows no balance reduction`,
        description: `Balance: $${currentBalance.toLocaleString()} (was $${oldBalance.toLocaleString()} 30 days ago) at ${c.tenant.unit.building.address} #${c.tenant.unit.unitNumber}.`,
        entityType: "tenant",
        entityId: c.tenantId,
        buildingId: c.buildingId,
        tenantId: c.tenantId,
        recommendedAction: "Payment plan tenant shows no balance reduction in 30 days. Review plan status.",
      });
    }
  }

  return signals;
}

// ── Detection: Lease Expiring — No Asking Rent Set ─────────────

async function detectLeaseExpiringNoAskingRent(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const sixtyDays = new Date();
  sixtyDays.setDate(sixtyDays.getDate() + 60);

  const tenants = await prisma.tenant.findMany({
    where: {
      leaseExpiration: { gte: new Date(), lte: sixtyDays },
      moveOutDate: null,
      unit: { askingRent: null },
    },
    select: {
      id: true,
      name: true,
      leaseExpiration: true,
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

  for (const t of tenants) {
    const daysUntil = Math.ceil((t.leaseExpiration!.getTime() - Date.now()) / 86400000);
    signals.push({
      deduplicationKey: `lease-expiring-no-asking-${t.unit.id}`,
      type: "leasing_risk",
      severity: daysUntil <= 30 ? "high" : "medium",
      title: `Lease expiring in ${daysUntil} days — no asking rent set`,
      description: `${t.name} at ${t.unit.building.address} #${t.unit.unitNumber}. Set asking rent to prepare for potential vacancy.`,
      entityType: "unit",
      entityId: t.unit.id,
      buildingId: t.unit.buildingId,
      tenantId: t.id,
      recommendedAction: "Set asking rent on this unit to prepare for potential turnover.",
    });
  }

  return signals;
}

// ── Detection: Vacant Unit — No Leasing Activity ───────────────

async function detectVacancyNoLeasingActivity(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const vacantUnits = await prisma.unit.findMany({
    where: {
      isVacant: true,
      isResidential: true,
      leasingActivities: { none: { createdAt: { gte: fourteenDaysAgo } } },
    },
    select: {
      id: true,
      unitNumber: true,
      buildingId: true,
      building: { select: { address: true } },
      vacancies: {
        where: { isActive: true },
        select: { createdAt: true },
        take: 1,
      },
    },
  });

  for (const u of vacantUnits) {
    const vacancyStart = u.vacancies[0]?.createdAt;
    const daysVacant = vacancyStart ? Math.ceil((Date.now() - vacancyStart.getTime()) / 86400000) : 0;

    signals.push({
      deduplicationKey: `vacancy-no-activity-${u.id}`,
      type: "leasing_risk",
      severity: daysVacant >= 30 ? "high" : "medium",
      title: `Vacant ${daysVacant} days — no recent leasing activity`,
      description: `${u.building.address} #${u.unitNumber} has had no leasing activity in the past 14 days.`,
      entityType: "unit",
      entityId: u.id,
      buildingId: u.buildingId,
      recommendedAction: "Log showings, inquiries, or follow-ups. No leasing activity in 14+ days.",
    });
  }

  return signals;
}

// ── Detection: Lease Expiring Soon — No Renewal Activity ───────

async function detectLeaseExpiringSoonNoRenewal(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];
  const now = new Date();
  const fortyFiveDays = new Date();
  fortyFiveDays.setDate(fortyFiveDays.getDate() + 45);

  const tenants = await prisma.tenant.findMany({
    where: {
      leaseExpiration: { gte: now, lte: fortyFiveDays },
      moveOutDate: null,
      leaseStatus: { in: ["active", "expiring-soon"] },
    },
    select: {
      id: true,
      name: true,
      leaseExpiration: true,
      unit: {
        select: {
          id: true,
          unitNumber: true,
          buildingId: true,
          building: { select: { address: true } },
          leases: {
            where: { leaseStart: { gte: now } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  for (const t of tenants) {
    // Skip if a future lease already exists (renewal signed)
    if (t.unit.leases.length > 0) continue;

    const daysUntil = Math.ceil((t.leaseExpiration!.getTime() - now.getTime()) / 86400000);
    signals.push({
      deduplicationKey: `lease-no-renewal-${t.id}`,
      type: "leasing_risk",
      severity: "high",
      title: `Lease expires in ${daysUntil} days — no renewal signed`,
      description: `${t.name} at ${t.unit.building.address} #${t.unit.unitNumber}. No future lease found.`,
      entityType: "tenant",
      entityId: t.id,
      buildingId: t.unit.buildingId,
      tenantId: t.id,
      recommendedAction: "Send renewal offer or begin vacancy preparation. No renewal lease on file.",
    });
  }

  return signals;
}

// ── Detection: Project Risks ─────────────────────────────────

async function detectProjectRisks(): Promise<DetectedSignal[]> {
  const signals: DetectedSignal[] = [];

  const projects = await prisma.project.findMany({
    where: { status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } },
    select: {
      id: true,
      name: true,
      status: true,
      health: true,
      buildingId: true,
      orgId: true,
      approvedBudget: true,
      actualCost: true,
      targetEndDate: true,
    },
  });

  for (const p of projects) {
    // Delayed
    if (p.health === "DELAYED" || (p.targetEndDate && new Date() > p.targetEndDate)) {
      signals.push({
        deduplicationKey: `project-delayed-${p.id}`,
        type: "project_delayed",
        severity: "high",
        title: `Project "${p.name}" is past target end date`,
        description: `Target was ${p.targetEndDate?.toISOString().split("T")[0]}. Status: ${p.status}.`,
        entityType: "project",
        entityId: p.id,
        buildingId: p.buildingId,
        recommendedAction: "Review project timeline and update target end date or escalate.",
      });
    }

    // Over budget
    if (p.approvedBudget && p.actualCost && Number(p.actualCost) > Number(p.approvedBudget) * 1.05) {
      const overBy = Number(p.actualCost) - Number(p.approvedBudget);
      signals.push({
        deduplicationKey: `project-over-budget-${p.id}`,
        type: "project_over_budget",
        severity: "high",
        title: `Project "${p.name}" is over budget`,
        description: `Actual $${Number(p.actualCost).toLocaleString()} exceeds approved $${Number(p.approvedBudget).toLocaleString()} by $${overBy.toLocaleString()}.`,
        entityType: "project",
        entityId: p.id,
        buildingId: p.buildingId,
        recommendedAction: "Review change orders and cost overruns. Consider submitting a change order.",
      });
    }

    // Pending approval
    if (p.status === "PENDING_APPROVAL") {
      signals.push({
        deduplicationKey: `project-pending-approval-${p.id}`,
        type: "project_pending_approval",
        severity: "medium",
        title: `Project "${p.name}" is waiting for approval`,
        description: `Project has been submitted for approval. Review and approve or reject.`,
        entityType: "project",
        entityId: p.id,
        buildingId: p.buildingId,
        recommendedAction: "Review project scope, budget, and timeline. Approve or send back for revisions.",
      });
    }
  }

  return signals;
}
