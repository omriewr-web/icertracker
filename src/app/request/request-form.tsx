"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Wrench, CheckCircle, AlertTriangle } from "lucide-react";

const CATEGORIES = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "HVAC", label: "HVAC / Heating" },
  { value: "APPLIANCE", label: "Appliance" },
  { value: "GENERAL", label: "General" },
  { value: "OTHER", label: "Other" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low — Not urgent" },
  { value: "MEDIUM", label: "Medium — Needs attention soon" },
  { value: "HIGH", label: "High — Needs prompt attention" },
  { value: "URGENT", label: "Urgent — Emergency" },
];

interface BuildingOption {
  id: string;
  address: string;
  units: { id: string; unitNumber: string }[];
}

export default function RequestForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState(false);

  const [form, setForm] = useState({
    tenantName: "",
    tenantContact: "",
    buildingId: "",
    unitId: "",
    category: "GENERAL",
    priority: "MEDIUM",
    title: "",
    description: "",
  });

  useEffect(() => {
    if (!token) {
      setTokenError(true);
      return;
    }
    fetch(`/api/work-orders/request?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invalid token");
        return r.json();
      })
      .then((data) => {
        setBuildings(Array.isArray(data) ? data : []);
        // Auto-select building if only one returned
        if (Array.isArray(data) && data.length === 1) {
          setForm((f) => ({ ...f, buildingId: data[0].id }));
        }
      })
      .catch(() => setTokenError(true));
  }, [token]);

  const selectedBuilding = buildings.find((b) => b.id === form.buildingId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/work-orders/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }

      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (tokenError) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Invalid or Missing Access Link</h2>
          <p className="text-sm text-text-muted">
            This form requires a valid building access link from your property manager.
            Please contact your building management office for the correct link.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Request Submitted</h2>
          <p className="text-sm text-text-muted mb-6">
            Your maintenance request has been received. Our team will review it and
            get back to you as soon as possible.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setForm({ tenantName: "", tenantContact: "", buildingId: buildings[0]?.id || "", unitId: "", category: "GENERAL", priority: "MEDIUM", title: "", description: "" });
            }}
            className="text-accent hover:text-accent-light text-sm"
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-accent/10 rounded-lg">
            <Wrench className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Maintenance Request</h1>
            <p className="text-xs text-text-dim">Submit a work order for your unit</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Your Name *</label>
              <input
                required value={form.tenantName}
                onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Phone / Email *</label>
              <input
                required value={form.tenantContact}
                onChange={(e) => setForm({ ...form, tenantContact: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                placeholder="How to reach you"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Building *</label>
              <select
                required value={form.buildingId}
                onChange={(e) => setForm({ ...form, buildingId: e.target.value, unitId: "" })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Select building</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.address}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Unit</label>
              <select
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                disabled={!selectedBuilding}
              >
                <option value="">Select unit</option>
                {selectedBuilding?.units.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-dim mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-dim mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-dim mb-1">Issue Title *</label>
            <input
              required value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              placeholder="e.g. Kitchen sink leaking"
            />
          </div>

          <div>
            <label className="block text-xs text-text-dim mb-1">Description *</label>
            <textarea
              required value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none"
              rows={4}
              placeholder="Please describe the issue in detail..."
            />
          </div>

          {/* Honeypot field — hidden from real users */}
          <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-light text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
