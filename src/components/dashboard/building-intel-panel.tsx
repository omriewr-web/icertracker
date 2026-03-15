"use client";

import type { RiskBuilding } from "./argus-threat-map";

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#e8323f",
  HIGH: "#e8911a",
  MEDIUM: "#c8901a",
  STABLE: "#00c460",
};
const RISK_LABELS: Record<string, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH RISK",
  MEDIUM: "MEDIUM RISK",
  STABLE: "STABLE",
};

export function BuildingIntelPanel({ building }: { building: RiskBuilding | null }) {
  if (!building) {
    return (
      <div className="bg-atlas-navy-3 border border-border rounded-lg flex flex-col overflow-hidden flex-1">
        <div className="p-2.5 border-b border-border">
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "8px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
            }}
            className="text-text-dim mb-0.5"
          >
            Building Intelligence
          </div>
          <div className="text-xs font-bold text-text-primary">Select a building</div>
        </div>
        <div
          className="text-text-dim"
          style={{
            padding: "20px",
            textAlign: "center",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            lineHeight: 1.8,
          }}
        >
          Click any node on the map
          <br />
          to view intelligence
        </div>
      </div>
    );
  }

  const col = RISK_COLORS[building.risk];
  const lbl = RISK_LABELS[building.risk];
  const isCritical = building.risk === "CRITICAL" || building.risk === "HIGH";

  return (
    <div className="bg-atlas-navy-3 border border-border rounded-lg flex flex-col overflow-hidden flex-1">
      <div className="p-2.5 border-b border-border">
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "8px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
          }}
          className="text-text-dim mb-0.5"
        >
          Building Intelligence
        </div>
        <div className="text-xs font-bold text-text-primary truncate">{building.address}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Risk banner */}
        <div
          style={{
            margin: "8px 10px 0",
            padding: "7px 10px",
            borderRadius: "5px",
            borderLeft: `3px solid ${col}`,
            background: `${col}18`,
          }}
        >
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "7px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: col,
              marginBottom: "2px",
            }}
          >
            Argus Risk Assessment
          </div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "15px",
              fontWeight: 500,
              color: col,
            }}
          >
            {lbl}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", padding: "8px 10px 0" }}>
          {[
            { label: "Units", val: String(building.units), color: "var(--atlas-text)" },
            {
              label: "AR Balance",
              val: building.arBalance > 0 ? `$${Math.round(building.arBalance).toLocaleString()}` : "$0",
              color: building.arBalance > 0 ? "#e8323f" : "#00c460",
            },
            {
              label: "Legal Cases",
              val: String(building.legalCases),
              color: building.legalCases > 0 ? "#e8323f" : "var(--atlas-text)",
            },
            {
              label: "Violations",
              val: String(building.openViolations),
              color: building.openViolations > 2 ? "#e8911a" : "var(--atlas-text)",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-border rounded"
              style={{ background: "var(--atlas-navy-4)", padding: "6px 8px" }}
            >
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "7px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
                className="text-text-dim"
              >
                {s.label}
              </div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "14px", fontWeight: 500, color: s.color }}>
                {s.val}
              </div>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ padding: "8px 10px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "5px" }}>
          {isCritical ? (
            <>
              <a
                href={`/legal?buildingId=${building.id}`}
                style={{
                  padding: "7px 10px",
                  borderRadius: "4px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9px",
                  letterSpacing: ".04em",
                  textDecoration: "none",
                  display: "block",
                  border: "1px solid rgba(232,145,26,.35)",
                  color: "#e8911a",
                  background: "rgba(232,145,26,.08)",
                }}
              >
                View Legal Pipeline ↗
              </a>
              <a
                href={`/themis?buildingId=${building.id}`}
                style={{
                  padding: "7px 10px",
                  borderRadius: "4px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9px",
                  letterSpacing: ".04em",
                  textDecoration: "none",
                  display: "block",
                  border: "1px solid rgba(200,144,26,.35)",
                  color: "#e8a520",
                  background: "rgba(200,144,26,.08)",
                }}
              >
                Themis — Generate Defense ↗
              </a>
            </>
          ) : (
            <a
              href={`/alerts?buildingId=${building.id}`}
              style={{
                padding: "7px 10px",
                borderRadius: "4px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "9px",
                letterSpacing: ".04em",
                textDecoration: "none",
                display: "block",
                border: "1px solid rgba(0,196,96,.3)",
                color: "#00c460",
                background: "rgba(0,196,96,.08)",
              }}
            >
              Argus — View Full Report ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
