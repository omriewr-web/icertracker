"use client";

import { useState, useEffect } from "react";
import { Shield, CheckCircle, Clock, AlertTriangle, Package } from "lucide-react";
import Button from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";
import EmptyState from "@/components/ui/empty-state";
import { useBuildings } from "@/hooks/use-buildings";
import { useAppStore } from "@/stores/app-store";
import { formatDate } from "@/lib/utils";

const AGENCY_OPTIONS = ["HPD", "DOB", "ECB"];

interface ViolationItem {
  id: string;
  externalId: string;
  description: string;
  class: string | null;
  source: string;
  lifecycleStatus: string;
  certifyByDate: string | null;
}

interface PacketItem {
  id: string;
  violationId: string;
  violation: ViolationItem;
}

interface CertPacket {
  id: string;
  agency: string;
  status: string;
  certifyByDate: string | null;
  createdAt: string;
  preparedBy: { id: string; name: string } | null;
  items: PacketItem[];
}

export default function CertificationPage() {
  const { selectedBuildingId } = useAppStore();
  const { data: buildings } = useBuildings();
  const [buildingId, setBuildingId] = useState(selectedBuildingId || "");
  const [agency, setAgency] = useState("HPD");
  const [violations, setViolations] = useState<ViolationItem[]>([]);
  const [packets, setPackets] = useState<CertPacket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [packetsLoading, setPacketsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBuildingId) setBuildingId(selectedBuildingId);
  }, [selectedBuildingId]);

  // Fetch PM_VERIFIED violations for selected building
  useEffect(() => {
    if (!buildingId) return;
    setLoading(true);
    fetch(`/api/violations?buildingId=${buildingId}&lifecycleStatus=PM_VERIFIED`)
      .then((r) => r.json())
      .then((data) => {
        setViolations(Array.isArray(data) ? data : []);
        setSelected(new Set());
      })
      .catch(() => setViolations([]))
      .finally(() => setLoading(false));
  }, [buildingId]);

  // Fetch existing packets
  useEffect(() => {
    if (!buildingId) return;
    setPacketsLoading(true);
    fetch(`/api/violations/certification-packets?buildingId=${buildingId}`)
      .then((r) => r.json())
      .then((data) => setPackets(Array.isArray(data) ? data : []))
      .catch(() => setPackets([]))
      .finally(() => setPacketsLoading(false));
  }, [buildingId]);

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === violations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(violations.map((v) => v.id)));
    }
  };

  const handleCreatePacket = async () => {
    if (selected.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/violations/certification-packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId,
          violationIds: [...selected],
          agency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create packet");
      }
      // Refresh
      setSelected(new Set());
      const [vRes, pRes] = await Promise.all([
        fetch(`/api/violations?buildingId=${buildingId}&lifecycleStatus=PM_VERIFIED`).then((r) => r.json()),
        fetch(`/api/violations/certification-packets?buildingId=${buildingId}`).then((r) => r.json()),
      ]);
      setViolations(Array.isArray(vRes) ? vRes : []);
      setPackets(Array.isArray(pRes) ? pRes : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED": return "text-green-400";
      case "PENDING_REVIEW":
      case "READY": return "text-yellow-400";
      case "REJECTED": return "text-red-400";
      case "SUBMITTED": return "text-blue-400";
      default: return "text-text-muted";
    }
  };

  const getDeadlineInfo = (certifyByDate: string | null) => {
    if (!certifyByDate) return null;
    const days = Math.ceil((new Date(certifyByDate).getTime() - Date.now()) / 86400000);
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "text-red-400" };
    if (days <= 2) return { text: `${days}d left`, color: "text-red-400" };
    if (days <= 5) return { text: `${days}d left`, color: "text-orange-400" };
    if (days <= 10) return { text: `${days}d left`, color: "text-yellow-400" };
    return { text: `${days}d left`, color: "text-green-400" };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-gold" />
        <h1 className="text-xl font-bold text-text-primary font-display">Certification Packets</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="bg-card border border-border rounded px-3 py-2 text-sm text-text-primary min-w-[200px]"
        >
          <option value="">Select Building</option>
          {buildings?.map((b: any) => (
            <option key={b.id} value={b.id}>{b.address}</option>
          ))}
        </select>

        <select
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          className="bg-card border border-border rounded px-3 py-2 text-sm text-text-primary"
        >
          {AGENCY_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {!buildingId ? (
        <EmptyState
          icon={Shield}
          title="Select a building"
          description="Choose a building to view PM-verified violations ready for certification."
        />
      ) : (
        <>
          {/* PM_VERIFIED violations */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">
                Ready for Certification ({violations.length})
              </h2>
              <div className="flex gap-2">
                {violations.length > 0 && (
                  <Button onClick={selectAll} className="text-xs">
                    {selected.size === violations.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
                <Button
                  onClick={handleCreatePacket}
                  disabled={selected.size === 0 || creating}
                  className="text-xs"
                >
                  {creating ? <LoadingSpinner /> : <Package className="w-3.5 h-3.5" />}
                  Create Packet ({selected.size})
                </Button>
              </div>
            </div>

            {error && <p className="px-4 py-2 text-xs text-red-400">{error}</p>}

            {loading ? (
              <div className="p-8 flex justify-center"><LoadingSpinner /></div>
            ) : violations.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-dim">
                No PM-verified violations found for this building.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted text-xs border-b border-border">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2">Violation #</th>
                    <th className="px-4 py-2">Class</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((v, i) => {
                    const deadline = getDeadlineInfo(v.certifyByDate);
                    return (
                      <tr
                        key={v.id}
                        className={`border-b border-border/50 cursor-pointer hover:bg-card-hover ${i % 2 === 0 ? "bg-card" : "bg-card/50"}`}
                        onClick={() => toggleSelection(v.id)}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(v.id)}
                            onChange={() => toggleSelection(v.id)}
                            className="accent-gold"
                          />
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{v.externalId}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            v.class === "C" ? "bg-red-500/10 text-red-400" :
                            v.class === "B" ? "bg-orange-500/10 text-orange-400" :
                            "bg-yellow-500/10 text-yellow-400"
                          }`}>
                            {v.class || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-text-muted max-w-[300px] truncate">{v.description}</td>
                        <td className="px-4 py-2">
                          {deadline ? (
                            <span className={`text-xs font-medium ${deadline.color}`}>{deadline.text}</span>
                          ) : (
                            <span className="text-text-dim text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Existing packets */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text-primary">Existing Packets</h2>
            </div>
            {packetsLoading ? (
              <div className="p-8 flex justify-center"><LoadingSpinner /></div>
            ) : packets.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-dim">
                No certification packets yet.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {packets.map((p) => {
                  const deadline = getDeadlineInfo(p.certifyByDate);
                  return (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium bg-card-hover px-2 py-0.5 rounded">{p.agency}</span>
                          <span className={`text-xs font-medium ${getStatusColor(p.status)}`}>{p.status}</span>
                          <span className="text-xs text-text-dim">{p.items.length} violation(s)</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          {deadline && (
                            <span className={`flex items-center gap-1 ${deadline.color}`}>
                              <Clock className="w-3 h-3" /> {deadline.text}
                            </span>
                          )}
                          <span>{formatDate(p.createdAt)}</span>
                          {p.preparedBy && <span>by {p.preparedBy.name}</span>}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {p.items.map((item) => (
                          <span key={item.id} className="text-[10px] bg-card-hover text-text-muted px-1.5 py-0.5 rounded font-mono">
                            {item.violation.externalId}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
