"use client";

import { useState, useCallback } from "react";
import { Camera, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";

const EVIDENCE_TYPES = [
  { value: "BEFORE", label: "Before" },
  { value: "AFTER", label: "After" },
  { value: "TENANT_SIGNATURE", label: "Tenant Signature" },
  { value: "SUPER_ATTESTATION", label: "Super Attestation" },
  { value: "MATERIAL_RECEIPT", label: "Material Receipt" },
  { value: "PM_VERIFICATION", label: "PM Verification" },
  { value: "NO_ACCESS", label: "No Access" },
] as const;

type EvidenceType = (typeof EVIDENCE_TYPES)[number]["value"];

interface EvidenceItem {
  id: string;
  type: string;
  imageUrl: string;
  capturedAt: string;
  notes: string | null;
}

interface EvidenceUploadProps {
  workOrderId: string;
  violationId?: string;
  onUpload?: () => void;
}

export default function EvidenceUpload({ workOrderId, violationId, onUpload }: EvidenceUploadProps) {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<EvidenceType>("BEFORE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/evidence`);
      if (res.ok) {
        const data = await res.json();
        setEvidence(data);
      }
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [workOrderId]);

  // Fetch on first render
  if (!fetched && !loading) {
    fetchEvidence();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10MB)");
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      // Convert to base64 data URL as imageUrl
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/work-orders/${workOrderId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: dataUrl,
          type: selectedType,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      setSuccess("Evidence uploaded successfully");
      setNotes("");
      await fetchEvidence();
      onUpload?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  // Group evidence by type
  const grouped = evidence.reduce<Record<string, EvidenceItem[]>>((acc, item) => {
    (acc[item.type] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Evidence Photos</h3>

      {/* Existing evidence */}
      {loading ? (
        <LoadingSpinner />
      ) : evidence.length === 0 ? (
        <p className="text-xs text-text-dim">No evidence uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <p className="text-xs font-medium text-text-muted mb-1">{type.replace(/_/g, " ")}</p>
              <div className="flex gap-2 flex-wrap">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="w-20 h-20 rounded bg-card-hover border border-border overflow-hidden relative group"
                  >
                    <img
                      src={item.imageUrl}
                      alt={`${type} evidence`}
                      className="w-full h-full object-cover"
                    />
                    {item.notes && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] text-white p-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload form */}
      <div className="border border-border rounded-lg p-3 bg-card space-y-3">
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as EvidenceType)}
            className="flex-1 bg-card-hover border border-border rounded px-2 py-1.5 text-sm text-text-primary"
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-card-hover border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-dim"
        />

        {selectedType === "AFTER" && violationId && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            This will mark the violation as evidence submitted
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <Button disabled={uploading} className="text-xs">
            {uploading ? (
              <>
                <LoadingSpinner /> Uploading...
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" /> Upload Photo
              </>
            )}
          </Button>
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && (
          <p className="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> {success}
          </p>
        )}
      </div>
    </div>
  );
}
