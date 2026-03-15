"use client";

import { cn } from "@/lib/utils";

interface TitanLoadingProps {
  titan?: "argus" | "coeus" | "prometheus" | "themis";
  message?: string;
  className?: string;
}

const TITAN_MESSAGES: Record<string, string> = {
  argus: "Argus is watching...",
  coeus: "Coeus is analyzing...",
  prometheus: "Prometheus is gathering intelligence...",
  themis: "Themis is reviewing...",
};

export default function TitanLoading({ titan = "argus", message, className }: TitanLoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 gap-4", className)}>
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        <div className="absolute inset-2 rounded-full border border-accent/10" />
        <div className="absolute inset-2 rounded-full border border-transparent border-b-accent/40 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium tracking-[0.2em] uppercase text-accent">
          {message || TITAN_MESSAGES[titan]}
        </p>
        <div className="mt-2 flex gap-1 justify-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-1 rounded-full bg-accent animate-atlas-live-blink"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
