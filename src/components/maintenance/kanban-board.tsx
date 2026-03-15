"use client";

import { useMemo } from "react";
import { WorkOrderView, WorkOrderStatus } from "@/types";
import { useUpdateWorkOrder } from "@/hooks/use-work-orders";
import PriorityBadge from "./priority-badge";
import CategoryBadge from "./category-badge";
import DueDateBadge from "./due-date-badge";
import SourceBadge from "./source-badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

const COLUMNS: { status: WorkOrderStatus; label: string; color: string }[] = [
  { status: "PENDING_REVIEW", label: "Pending Review", color: "border-t-purple-500" },
  { status: "OPEN", label: "Open", color: "border-t-blue-500" },
  { status: "IN_PROGRESS", label: "In Progress", color: "border-t-amber-500" },
  { status: "ON_HOLD", label: "On Hold", color: "border-t-gray-500" },
  { status: "COMPLETED", label: "Completed", color: "border-t-green-500" },
];

interface Props {
  workOrders: WorkOrderView[];
  onSelect: (wo: WorkOrderView) => void;
}

export default function KanbanBoard({ workOrders, onSelect }: Props) {
  const updateWO = useUpdateWorkOrder();

  const grouped = useMemo(() => {
    const map: Record<string, WorkOrderView[]> = {
      PENDING_REVIEW: [], OPEN: [], IN_PROGRESS: [], ON_HOLD: [], COMPLETED: [],
    };
    workOrders.forEach((wo) => {
      (map[wo.status] || map.OPEN).push(wo);
    });
    return map;
  }, [workOrders]);

  function handleDrop(e: React.DragEvent, newStatus: WorkOrderStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const wo = workOrders.find((w) => w.id === id);
    if (wo && wo.status !== newStatus) {
      updateWO.mutate({ id, data: { status: newStatus } });
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 min-h-[500px]">
      {COLUMNS.map((col) => (
        <div
          key={col.status}
          className={cn("bg-card/50 border border-border rounded-xl flex flex-col border-t-2", col.color)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, col.status)}
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{col.label}</h3>
            <span className="text-xs text-text-dim bg-border/50 px-1.5 py-0.5 rounded-full">
              {(grouped[col.status] || []).length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {(grouped[col.status] || []).map((wo) => (
              <div
                key={wo.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", wo.id)}
                onClick={() => onSelect(wo)}
                className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-border-light transition-colors"
              >
                <p className="text-sm font-medium text-text-primary line-clamp-2 mb-2">{wo.title}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  <PriorityBadge priority={wo.priority} />
                  <CategoryBadge category={wo.category} />
                  <DueDateBadge dueDate={wo.dueDate} status={wo.status} />
                  <SourceBadge sourceType={wo.sourceType} />
                </div>
                <div className="flex items-center justify-between text-xs text-text-dim">
                  <span>{wo.buildingAddress}</span>
                  {wo.unitNumber && <span>#{wo.unitNumber}</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-text-dim mt-1">
                  <span>{formatDate(wo.createdAt)}</span>
                  {wo.commentCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MessageSquare className="w-3 h-3" /> {wo.commentCount}
                    </span>
                  )}
                </div>
                {wo.assignedToName && (
                  <p className="text-xs text-accent mt-1">{wo.assignedToName}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
