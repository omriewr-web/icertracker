import { UserRole } from "@/types";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      assignedProperties: string[];
      organizationId: string | null;
      managerId: string | null;
      onboardingComplete: boolean;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    assignedProperties: string[];
    organizationId: string | null;
    managerId: string | null;
    onboardingComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    assignedProperties: string[];
    organizationId: string | null;
    managerId: string | null;
    onboardingComplete: boolean;
  }
}
