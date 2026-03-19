"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import Button from "@/components/ui/button";
import { useCreateConversation } from "@/hooks/use-comms";
import { Search } from "lucide-react";

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export default function NewConversationModal({
  open,
  onClose,
  onCreated,
}: NewConversationModalProps) {
  const [type, setType] = useState<"direct" | "group">("direct");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [relatedEntityType, setRelatedEntityType] = useState("");
  const [relatedEntityId, setRelatedEntityId] = useState("");
  const [relatedEntityLabel, setRelatedEntityLabel] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [entityResults, setEntityResults] = useState<Array<{ id: string; label: string; buildingId?: string }>>([]);
  const [buildingId, setBuildingId] = useState<string | undefined>();

  const createConversation = useCreateConversation();

  // Fetch users for member selection
  useEffect(() => {
    if (!open) return;
    fetch("/api/users")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users ?? [];
        setUsers(list.map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
      })
      .catch(() => {});
  }, [open]);

  // Search entities when type + query change
  useEffect(() => {
    if (!relatedEntityType || entitySearch.length < 2) {
      setEntityResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const endpointMap: Record<string, string> = {
          work_order: "/api/work-orders",
          building: "/api/buildings",
        };
        const endpoint = endpointMap[relatedEntityType];
        if (!endpoint) return;
        const res = await fetch(`${endpoint}?search=${encodeURIComponent(entitySearch)}&limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setEntityResults(
          list.slice(0, 10).map((item: any) => ({
            id: item.id,
            label: item.title ?? item.address ?? item.name ?? item.id,
            buildingId: item.buildingId,
          }))
        );
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [relatedEntityType, entitySearch]);

  function handleSubmit() {
    if (type === "direct" && selectedUsers.length === 1) {
      createConversation.mutate(
        {
          type: "direct",
          targetUserId: selectedUsers[0].id,
        },
        {
          onSuccess: (data) => {
            resetForm();
            onCreated(data.conversation.id);
          },
        }
      );
    } else if (type === "group" && groupTitle.trim() && selectedUsers.length > 0) {
      createConversation.mutate(
        {
          type: "group",
          title: groupTitle.trim(),
          memberIds: selectedUsers.map((u) => u.id),
          relatedEntityType: relatedEntityType || undefined,
          relatedEntityId: relatedEntityId || undefined,
          buildingId,
        },
        {
          onSuccess: (data) => {
            resetForm();
            onCreated(data.conversation.id);
          },
        }
      );
    }
  }

  function resetForm() {
    setType("direct");
    setSearch("");
    setSelectedUsers([]);
    setGroupTitle("");
    setRelatedEntityType("");
    setRelatedEntityId("");
    setRelatedEntityLabel("");
    setEntitySearch("");
    setEntityResults([]);
    setBuildingId(undefined);
  }

  function toggleUser(user: UserOption) {
    if (type === "direct") {
      setSelectedUsers([user]);
    } else {
      setSelectedUsers((prev) =>
        prev.find((u) => u.id === user.id)
          ? prev.filter((u) => u.id !== user.id)
          : [...prev, user]
      );
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const canSubmit =
    type === "direct"
      ? selectedUsers.length === 1
      : selectedUsers.length > 0 && groupTitle.trim();

  return (
    <Modal
      open={open}
      onClose={() => { resetForm(); onClose(); }}
      title="New Conversation"
    >
      <div className="space-y-4">
        {/* Type selector */}
        <div className="flex gap-2">
          <button
            onClick={() => { setType("direct"); setSelectedUsers([]); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
              type === "direct"
                ? "bg-accent/10 text-accent border-accent/30"
                : "border-border text-text-dim hover:text-text-muted"
            }`}
          >
            Direct Message
          </button>
          <button
            onClick={() => { setType("group"); setSelectedUsers([]); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
              type === "group"
                ? "bg-accent/10 text-accent border-accent/30"
                : "border-border text-text-dim hover:text-text-muted"
            }`}
          >
            Group Chat
          </button>
        </div>

        {/* Group title */}
        {type === "group" && (
          <input
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            placeholder="Group name..."
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        )}

        {/* Selected users chips */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedUsers.map((u) => (
              <span
                key={u.id}
                className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent flex items-center gap-1"
              >
                {u.name}
                <button onClick={() => toggleUser(u)} className="hover:text-red-400">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team members..."
            className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
          />
        </div>

        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {filteredUsers.map((u) => {
            const isSelected = selectedUsers.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => toggleUser(u)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                  isSelected
                    ? "bg-accent/10 text-accent"
                    : "text-text-muted hover:bg-white/[0.03]"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[10px] font-bold">
                  {u.name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 truncate">{u.name}</span>
                <span className="text-[10px] text-text-dim">{u.email}</span>
              </button>
            );
          })}
        </div>

        {/* Link to record (optional) */}
        {type === "group" && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[10px] text-text-dim uppercase tracking-wider">
              Link to a record (optional)
            </p>
            {!relatedEntityId ? (
              <>
                <select
                  value={relatedEntityType}
                  onChange={(e) => {
                    setRelatedEntityType(e.target.value);
                    setEntitySearch("");
                    setEntityResults([]);
                  }}
                  className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Select type...</option>
                  <option value="work_order">Work Order</option>
                  <option value="building">Building</option>
                </select>
                {relatedEntityType && (
                  <>
                    <input
                      value={entitySearch}
                      onChange={(e) => setEntitySearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-bg border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
                    />
                    {entityResults.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-0.5">
                        {entityResults.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setRelatedEntityId(r.id);
                              setRelatedEntityLabel(r.label);
                              setBuildingId(r.buildingId);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded text-xs text-text-muted hover:bg-white/[0.03] transition-colors"
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-accent/5 border border-accent/20 rounded-lg text-xs">
                <span className="text-accent flex-1 truncate">
                  {relatedEntityType.replace(/_/g, " ")}: {relatedEntityLabel}
                </span>
                <button
                  onClick={() => {
                    setRelatedEntityId("");
                    setRelatedEntityLabel("");
                    setBuildingId(undefined);
                  }}
                  className="text-text-dim hover:text-red-400"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || createConversation.isPending}
          >
            {createConversation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
