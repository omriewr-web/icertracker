"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AtlasErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function AtlasError({ title = "System Error", message = "Something went wrong. Please try again.", onRetry, className }: AtlasErrorProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      <div className="w-12 h-12 rounded-full bg-atlas-red/10 flex items-center justify-center mb-4 animate-atlas-pulse-red">
        <AlertTriangle className="w-6 h-6 text-atlas-red" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary tracking-wide uppercase mb-1">{title}</h3>
      <p className="text-xs text-text-dim max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-1.5 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/10 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
