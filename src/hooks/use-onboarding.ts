"use client";

import { useQuery } from "@tanstack/react-query";
import type { OnboardingStatusResponse } from "@/app/api/onboarding/status/route";

export function useOnboarding() {
  return useQuery<OnboardingStatusResponse>({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/status");
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json();
    },
    staleTime: 60_000,
  });
}
