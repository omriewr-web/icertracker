import type { UserRole } from "@/types";
import { prisma } from "./prisma";

interface AuthStateRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  managerId: string | null;
  onboardingComplete: boolean;
  active: boolean;
}

export interface CurrentAuthUser extends AuthStateRecord {
  assignedProperties: string[];
}

const MANAGER_PROPERTY_ROLES = new Set<UserRole>(["APM", "LEASING_SPECIALIST", "ACCOUNTING"]);

async function loadAssignedProperties(userId: string): Promise<string[]> {
  const props = await prisma.userProperty.findMany({
    where: { userId },
    select: { buildingId: true },
  });

  return props.map((prop) => prop.buildingId);
}

export async function getEffectiveAssignedProperties(user: {
  id: string;
  role: UserRole;
  managerId: string | null;
}): Promise<string[]> {
  if (MANAGER_PROPERTY_ROLES.has(user.role) && user.managerId) {
    return loadAssignedProperties(user.managerId);
  }

  return loadAssignedProperties(user.id);
}

export async function hydrateCurrentAuthUser(user: AuthStateRecord): Promise<CurrentAuthUser> {
  return {
    ...user,
    assignedProperties: await getEffectiveAssignedProperties(user),
  };
}

export async function loadFreshAuthUserById(userId: string): Promise<CurrentAuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      managerId: true,
      onboardingComplete: true,
      active: true,
    },
  });

  if (!user || !user.active) {
    return null;
  }

  return hydrateCurrentAuthUser({
    ...user,
    organizationId: user.organizationId ?? null,
    managerId: user.managerId ?? null,
  });
}
