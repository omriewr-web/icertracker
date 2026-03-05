"use client";

import { useAppStore } from "@/stores/app-store";
import { useBuildings } from "@/hooks/use-buildings";
import { Info, Plus } from "lucide-react";

export default function PropertySelector() {
  const { selectedBuildingId, setSelectedBuildingId, setDetailBuildingId, openBuildingForm } = useAppStore();
  const { data: buildings } = useBuildings();

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectedBuildingId || ""}
        onChange={(e) => setSelectedBuildingId(e.target.value || null)}
        className="flex-1 bg-bg border border-border rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
      >
        <option value="">All Properties</option>
        {buildings?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.address}
          </option>
        ))}
      </select>
      {selectedBuildingId && (
        <button
          onClick={() => setDetailBuildingId(selectedBuildingId)}
          className="p-1.5 rounded-lg text-text-dim hover:text-accent hover:bg-card-hover transition-colors"
          title="Building details"
        >
          <Info className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => openBuildingForm()}
        className="p-1.5 rounded-lg text-text-dim hover:text-accent hover:bg-card-hover transition-colors"
        title="Add building"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
