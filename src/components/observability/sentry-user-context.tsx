"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import * as Sentry from "@sentry/nextjs";

export function SentryUserContext() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    const user = session?.user;

    if (!user?.id) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
    });

    if (user.organizationId) {
      Sentry.setTag("organizationId", user.organizationId);
    }

    if (user.role) {
      Sentry.setTag("userRole", user.role);
    }
  }, [session, status]);

  return null;
}
