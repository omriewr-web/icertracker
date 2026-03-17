"use client";

import { useState } from "react";
import type { TextEnhanceContext } from "@/lib/ai/types";

interface EnhanceParams {
  text: string;
  context: TextEnhanceContext;
}

export function useAITextEnhance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enhance({ text, context }: EnhanceParams): Promise<string | null> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/enhance-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Enhancement failed" }));
        throw new Error(err.error || "Enhancement failed");
      }
      const data = await res.json();
      return data.enhanced ?? null;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Enhancement failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { enhance, loading, error };
}
