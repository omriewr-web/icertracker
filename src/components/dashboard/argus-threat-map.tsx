"use client";

import { useEffect, useRef, useState } from "react";

export interface RiskBuilding {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  units: number;
  arBalance: number;
  legalCases: number;
  openViolations: number;
  risk: "CRITICAL" | "HIGH" | "MEDIUM" | "STABLE";
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#e8323f",
  HIGH: "#e8911a",
  MEDIUM: "#c8901a",
  STABLE: "#00c460",
};

const RISK_RADIUS: Record<string, number> = { CRITICAL: 10, HIGH: 8, MEDIUM: 6, STABLE: 5 };

interface Props {
  onSelect: (building: RiskBuilding | null) => void;
  selected: RiskBuilding | null;
}

export function ArgusThreatMap({ onSelect, selected }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [buildings, setBuildings] = useState<RiskBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    fetch("/api/buildings/risk-map")
      .then((r) => r.json())
      .then((data: RiskBuilding[]) => {
        setBuildings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || buildings.length === 0) return;

    const loadLeaflet = () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if ((window as any).L) {
        initMap();
      } else {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = initMap;
        document.head.appendChild(script);
      }
    };

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current || mapInstance.current) return;

      const map = L.map(mapRef.current, {
        center: [40.73, -73.935],
        zoom: 11,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;

      const geocodedBuildings = buildings.filter((b) => b.lat && b.lng);

      geocodedBuildings.forEach((b) => {
        const color = RISK_COLORS[b.risk];
        const radius = RISK_RADIUS[b.risk];

        if (b.risk === "CRITICAL") {
          L.circleMarker([b.lat!, b.lng!], {
            radius: radius + 7,
            fillColor: "transparent",
            color,
            weight: 1,
            opacity: 0.3,
          }).addTo(map);
        }

        const marker = L.circleMarker([b.lat!, b.lng!], {
          radius,
          fillColor: color,
          color: "transparent",
          weight: 0,
          fillOpacity: 0.88,
        });

        marker.on("click", () => onSelect(b));
        marker.bindTooltip(b.address, {
          permanent: false,
          direction: "top",
          className: "argus-tt",
          offset: [0, -radius - 2],
        });

        marker.addTo(map);
        markersRef.current.push(marker);
      });
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markersRef.current = [];
      }
    };
  }, [buildings, loading, onSelect]);

  async function runGeocode() {
    setGeocoding(true);
    await fetch("/api/buildings/geocode", { method: "POST" });
    const data = await fetch("/api/buildings/risk-map").then((r) => r.json());
    setBuildings(Array.isArray(data) ? data : []);
    setGeocoding(false);
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
      markersRef.current = [];
    }
  }

  const ungeocoded = buildings.filter((b) => !b.lat || !b.lng).length;
  const critical = buildings.filter((b) => b.risk === "CRITICAL").length;
  const high = buildings.filter((b) => b.risk === "HIGH").length;
  const stable = buildings.filter((b) => b.risk === "STABLE").length;

  if (loading) {
    return (
      <div
        style={{
          height: "320px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#05080e",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "10px",
          letterSpacing: ".12em",
          color: "var(--atlas-text-dim)",
          textTransform: "uppercase",
        }}
      >
        Scanning buildings...
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <div ref={mapRef} style={{ height: "320px", background: "#05080e" }} />

      {/* Sweep line */}
      <div
        className="animate-argus-sweep"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent, #00b8d4, transparent)",
          opacity: 0.4,
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "12px",
          zIndex: 1000,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "8px",
          letterSpacing: ".15em",
          color: "var(--atlas-text-dim)",
          textTransform: "uppercase",
          pointerEvents: "none",
          background: "rgba(6,8,15,0.7)",
          padding: "2px 6px",
          borderRadius: "3px",
        }}
      >
        Building Risk Map — New York City
      </div>

      {/* Stats overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "12px",
          zIndex: 1000,
          display: "flex",
          gap: "14px",
          pointerEvents: "none",
          background: "rgba(6,8,15,0.75)",
          padding: "5px 10px",
          borderRadius: "5px",
        }}
      >
        {[
          { v: critical, l: "Critical", c: "#e8323f" },
          { v: high, l: "High", c: "#e8911a" },
          { v: stable, l: "Stable", c: "#00c460" },
        ].map((s) => (
          <div key={s.l} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "14px",
                fontWeight: 500,
                color: s.c,
                lineHeight: 1,
              }}
            >
              {s.v}
            </span>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "7px",
                letterSpacing: ".12em",
                color: "var(--atlas-text-dim)",
                textTransform: "uppercase",
              }}
            >
              {s.l}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "12px",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          pointerEvents: "none",
          background: "rgba(6,8,15,0.75)",
          padding: "5px 8px",
          borderRadius: "5px",
        }}
      >
        {Object.entries(RISK_COLORS).map(([risk, color]) => (
          <div
            key={risk}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "8px",
              color: "var(--atlas-text-secondary)",
            }}
          >
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
            {risk.charAt(0) + risk.slice(1).toLowerCase()}
          </div>
        ))}
      </div>

      {/* Geocode banner */}
      {ungeocoded > 0 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            background: "var(--atlas-navy-3)",
            border: "1px solid var(--atlas-border)",
            borderRadius: "6px",
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "9px",
              color: "var(--atlas-text-dim)",
            }}
          >
            {ungeocoded} building{ungeocoded !== 1 ? "s" : ""} not yet mapped
          </span>
          <button
            onClick={runGeocode}
            disabled={geocoding}
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "9px",
              color: "#060c17",
              background: "#00b8d4",
              border: "none",
              borderRadius: "4px",
              padding: "3px 9px",
              cursor: geocoding ? "wait" : "pointer",
            }}
          >
            {geocoding ? "Geocoding..." : "Map All Buildings"}
          </button>
        </div>
      )}
    </div>
  );
}
