"use client";

import Link from "next/link";
import { useSignals } from "@/hooks/use-signals";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#e8323f",
  high: "#e8911a",
  medium: "#c8901a",
  low: "#00b8d4",
};

export function LiveAlertsPanel() {
  const { data } = useSignals({ status: "active" });
  const signals = data?.signals ?? [];
  const total = data?.counts?.total ?? 0;

  // Show top 4 most critical signals
  const top = signals
    .sort((a: any, b: any) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
    })
    .slice(0, 4);

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-2">
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "8px",
            letterSpacing: ".15em",
            textTransform: "uppercase",
          }}
          className="text-text-dim"
        >
          Intelligence Alerts
        </div>
        <Link
          href="/coeus"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            color: total > 0 ? "#e8323f" : "#00c460",
            border: `1px solid ${total > 0 ? "rgba(232,50,63,.3)" : "rgba(0,196,96,.3)"}`,
            background: total > 0 ? "rgba(232,50,63,.08)" : "rgba(0,196,96,.08)",
            borderRadius: "4px",
            padding: "1px 6px",
            textDecoration: "none",
          }}
        >
          {total} active
        </Link>
      </div>
      {top.length === 0 ? (
        <div
          className="text-text-dim"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            textAlign: "center",
            padding: "12px",
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          All clear
        </div>
      ) : (
        top.map((s: any, i: number) => (
          <div
            key={s.id}
            className="flex items-start gap-1.5"
            style={{
              padding: "5px 0",
              borderBottom: i < top.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
            }}
          >
            <div
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: SEVERITY_COLORS[s.severity] ?? "#00b8d4",
                flexShrink: 0,
                marginTop: "4px",
                boxShadow: `0 0 5px ${SEVERITY_COLORS[s.severity] ?? "#00b8d4"}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="text-text-primary truncate"
                style={{ fontSize: "11px", fontWeight: 500, lineHeight: 1.3, marginBottom: "1px" }}
              >
                {s.title}
              </div>
              <div
                className="text-text-dim truncate"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "8px" }}
              >
                {s.description?.slice(0, 50) || s.type}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
