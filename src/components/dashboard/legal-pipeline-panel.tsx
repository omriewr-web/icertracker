"use client";

import { useEffect, useState } from "react";

const STAGE_ORDER = [
  "NOTICE_SENT",
  "NONPAYMENT",
  "COURT_DATE",
  "STIPULATION",
  "WARRANT",
  "HOLDOVER",
  "EVICTION",
  "SETTLED",
];
const STAGE_LABELS: Record<string, string> = {
  NOTICE_SENT: "Notice Sent",
  NONPAYMENT: "Nonpayment",
  COURT_DATE: "Court Date",
  STIPULATION: "Stipulation",
  WARRANT: "Warrant",
  HOLDOVER: "Holdover",
  EVICTION: "Eviction",
  SETTLED: "Settled",
};
const STAGE_COLORS: Record<string, string> = {
  NOTICE_SENT: "#e8911a",
  NONPAYMENT: "#e8323f",
  COURT_DATE: "#c8901a",
  STIPULATION: "#c8901a",
  WARRANT: "#e8323f",
  HOLDOVER: "#e8911a",
  EVICTION: "#e8323f",
  SETTLED: "#00c460",
};

export function LegalPipelinePanel() {
  const [stages, setStages] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/legal")
      .then((r) => r.json())
      .then((data: any) => {
        const cases = Array.isArray(data) ? data : data.cases ?? data.data ?? [];
        const counts: Record<string, number> = {};
        cases.forEach((c: any) => {
          const stage = c.stage ?? c.status ?? "UNKNOWN";
          counts[stage] = (counts[stage] ?? 0) + 1;
        });
        setStages(counts);
        setTotal(cases.length);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const activeStages = STAGE_ORDER.filter((s) => (stages[s] ?? 0) > 0);

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "8px",
            letterSpacing: ".15em",
            textTransform: "uppercase",
          }}
          className="text-text-dim"
        >
          Legal Pipeline
        </div>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "8px",
            border: "1px solid rgba(0,184,212,.3)",
            background: "rgba(0,184,212,.08)",
            borderRadius: "3px",
            padding: "1px 6px",
            color: "#00b8d4",
          }}
        >
          {total} ACTIVE
        </div>
      </div>
      {!loaded ? (
        <div
          className="text-text-dim"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            textAlign: "center",
            padding: "20px",
          }}
        >
          Loading...
        </div>
      ) : activeStages.length === 0 ? (
        <div
          className="text-text-dim"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            textAlign: "center",
            padding: "20px",
          }}
        >
          No active cases
        </div>
      ) : (
        activeStages.map((stage) => (
          <div
            key={stage}
            className="flex items-center justify-between"
            style={{ padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
          >
            <div className="text-xs font-medium text-text-primary">{STAGE_LABELS[stage] ?? stage}</div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                fontWeight: 500,
                color: STAGE_COLORS[stage] ?? "#dde6f8",
              }}
            >
              {stages[stage]}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
