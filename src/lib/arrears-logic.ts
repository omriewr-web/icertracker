import { prisma } from "@/lib/prisma";
import { demandLetter, type EmailContext } from "@/lib/email-templates";
import { getOrgScope, EMPTY_SCOPE } from "@/lib/data-scope";

interface LegalRiskLease {
  leaseId: string;
  tenantId: string;
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  buildingId: string;
  monthlyRent: number;
  currentBalance: number;
  monthsOwed: number;
  leaseEnd: string | null;
  hasActiveLegalCase: boolean;
}

/**
 * Returns leases where balance > 2x monthlyRent OR arrears > 90 days (≈ 3x rent).
 * Scoped to the user's organization.
 */
export async function getLegalRiskLeases(
  organizationId: string,
): Promise<LegalRiskLease[]> {
  const leases = await prisma.lease.findMany({
    where: {
      organizationId,
      isCurrent: true,
      currentBalance: { gt: 0 },
    },
    select: {
      id: true,
      tenantId: true,
      monthlyRent: true,
      currentBalance: true,
      leaseEnd: true,
      buildingId: true,
      tenant: {
        select: {
          name: true,
          unit: {
            select: {
              unitNumber: true,
              building: { select: { address: true } },
            },
          },
          legalCases: {
            where: { isActive: true },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  return leases
    .filter((l) => {
      const rent = Number(l.monthlyRent) || 0;
      const bal = Number(l.currentBalance) || 0;
      if (rent <= 0) return false;
      return bal >= rent * 2;
    })
    .map((l) => {
      const rent = Number(l.monthlyRent);
      const bal = Number(l.currentBalance);
      return {
        leaseId: l.id,
        tenantId: l.tenantId ?? "",
        tenantName: l.tenant?.name ?? "Unknown",
        unitNumber: l.tenant?.unit?.unitNumber ?? "",
        buildingAddress: l.tenant?.unit?.building?.address ?? "",
        buildingId: l.buildingId ?? "",
        monthlyRent: rent,
        currentBalance: bal,
        monthsOwed: rent > 0 ? Math.round((bal / rent) * 10) / 10 : 0,
        leaseEnd: l.leaseEnd?.toISOString() ?? null,
        hasActiveLegalCase: (l.tenant?.legalCases?.length ?? 0) > 0,
      };
    })
    .sort((a, b) => b.currentBalance - a.currentBalance);
}

/**
 * Generates a rent demand letter draft for a tenant using the demandLetter template.
 */
export async function generateRentDemandDraft(
  tenantId: string,
  managerName: string,
  opts?: { managerPhone?: string; managerEmail?: string; companyName?: string },
): Promise<{ subject: string; body: string } | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      balance: true,
      marketRent: true,
      leaseExpiration: true,
      unit: {
        select: {
          unitNumber: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  if (!tenant || !tenant.unit) return null;

  const balance = Number(tenant.balance);
  const marketRent = Number(tenant.marketRent);
  if (balance <= 0) return null;

  const ctx: EmailContext = {
    tenantName: tenant.name,
    unitNumber: tenant.unit.unitNumber,
    buildingAddress: tenant.unit.building?.address ?? "",
    balance,
    monthsOwed: marketRent > 0 ? balance / marketRent : 0,
    arrearsDays: marketRent > 0 ? Math.round((balance / marketRent) * 30) : 0,
    marketRent,
    leaseExpiration: tenant.leaseExpiration?.toISOString() ?? null,
    managerName,
    managerPhone: opts?.managerPhone,
    managerEmail: opts?.managerEmail,
    companyName: opts?.companyName,
  };

  return demandLetter(ctx);
}
