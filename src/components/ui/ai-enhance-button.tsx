"use client";

import { useState, useEffect } from "react";
import { Sparkles, Undo2, Loader2 } from "lucide-react";
import { useAITextEnhance } from "@/hooks/useAITextEnhance";
import type { TextEnhanceContext } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface AIEnhanceButtonProps {
  value: string;
  context: TextEnhanceContext;
  onEnhanced: (enhanced: string) => void;
  setValue?: (value: string) => void; // RHF compatibility
  className?: string;
}

export default function AIEnhanceButton({ value, context, onEnhanced, setValue, className }: AIEnhanceButtonProps) {
  const { enhance, loading, error } = useAITextEnhance();
  const [original, setOriginal] = useState<string | null>(null);
  const [showRevert, setShowRevert] = useState(false);

  // Auto-hide revert after 10 seconds
  useEffect(() => {
    if (!showRevert) return;
    const timer = setTimeout(() => { setShowRevert(false); setOriginal(null); }, 10000);
    return () => clearTimeout(timer);
  }, [showRevert]);

  async function handleEnhance() {
    setOriginal(value);
    const result = await enhance({ text: value, context });
    if (result) {
      if (setValue) setValue(result);
      else onEnhanced(result);
      setShowRevert(true);
    }
  }

  function handleRevert() {
    if (original != null) {
      if (setValue) setValue(original);
      else onEnhanced(original);
    }
    setShowRevert(false);
    setOriginal(null);
  }

  const showHint = value.length >= 5 && value.length < 10;
  const showButton = value.length >= 10;

  if (!showHint && !showButton) return null;

  return (
    <div className={cn("flex items-center gap-2 mt-1", className)}>
      {showHint && !showButton && (
        <span className="text-[10px] text-accent/60">&#10022; AI Enhance available</span>
      )}

      {showButton && !showRevert && (
        <button
          type="button"
          onClick={handleEnhance}
          disabled={loading}
          className={cn(
            "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors",
            loading
              ? "border-border text-text-dim cursor-wait"
              : "border-accent/30 text-accent/70 hover:text-accent hover:border-accent/50"
          )}
        >
          {loading ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Enhancing...</>
          ) : (
            <><Sparkles className="w-3 h-3" /> Enhance</>
          )}
        </button>
      )}

      {showRevert && (
        <button
          type="button"
          onClick={handleRevert}
          className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-border text-text-dim hover:text-text-muted transition-colors"
        >
          <Undo2 className="w-3 h-3" /> Revert
        </button>
      )}

      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
