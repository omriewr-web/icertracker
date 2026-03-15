"use client";

interface BuildingAR {
  address: string;
  totalBalance: number;
}

export function ArrearsBarPanel({ buildings }: { buildings: BuildingAR[] }) {
  const sorted = [...buildings]
    .filter((b) => b.totalBalance > 0)
    .sort((a, b) => b.totalBalance - a.totalBalance)
    .slice(0, 7);

  const max = sorted[0]?.totalBalance ?? 1;

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
          Arrears by Building
        </div>
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "8px",
            border: "1px solid var(--atlas-gold-dim)",
            borderRadius: "3px",
            padding: "1px 6px",
          }}
          className="text-accent"
        >
          LIVE
        </div>
      </div>
      {sorted.length === 0 ? (
        <div
          className="text-text-dim"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "9px",
            textAlign: "center",
            padding: "20px",
          }}
        >
          No arrears data
        </div>
      ) : (
        sorted.map((b) => {
          const pct = (b.totalBalance / max) * 100;
          const color = pct > 70 ? "#e8323f" : pct > 40 ? "#c8901a" : "#00b8d4";
          const short = b.address.length > 20 ? b.address.slice(0, 20) + "\u2026" : b.address;
          return (
            <div key={b.address} className="flex items-center gap-2 mb-2">
              <div
                className="text-text-secondary shrink-0"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", width: "100px" }}
              >
                {short}
              </div>
              <div className="flex-1 rounded-sm overflow-hidden" style={{ height: "5px", background: "var(--atlas-navy-4)" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: "3px",
                    transition: "width .6s ease",
                  }}
                />
              </div>
              <div
                className="text-text-secondary shrink-0 text-right"
                style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "9px", width: "48px" }}
              >
                ${Math.round(b.totalBalance / 1000)}K
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
