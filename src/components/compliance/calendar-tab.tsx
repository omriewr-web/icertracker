"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { useComplianceItems } from "@/hooks/use-compliance";
import { CalendarSkeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";

export default function CalendarTab() {
  const { data: items, isLoading } = useComplianceItems();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [year, month]);

  const itemsByDay = useMemo(() => {
    const map = new Map<number, typeof items>();
    if (!items) return map;

    for (const item of items) {
      const dueDate = item.nextDueDate ? new Date(item.nextDueDate) : null;
      if (!dueDate) continue;
      if (dueDate.getFullYear() === year && dueDate.getMonth() === month) {
        const day = dueDate.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(item);
      }
    }
    return map;
  }, [items, year, month]);

  if (isLoading) return <CalendarSkeleton />;

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No compliance items scheduled"
        description="Add compliance items in the Tracker tab to see them on the calendar."
      />
    );
  }

  const now = new Date();

  function getDotColor(item: any) {
    if (item.status === "COMPLIANT") return "bg-green-400";
    const dueDate = item.nextDueDate ? new Date(item.nextDueDate) : null;
    if (!dueDate) return "bg-gray-400";
    const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return "bg-red-400";
    if (diff < 30) return "bg-orange-400";
    if (diff < 60) return "bg-yellow-400";
    return "bg-green-400";
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 text-text-dim hover:text-text-primary">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-sm font-semibold text-text-primary">{monthName}</h3>
        <button onClick={nextMonth} className="p-2 text-text-dim hover:text-text-primary">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-text-dim border-b border-border">
              {d}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const dayItems = day ? itemsByDay.get(day) : undefined;
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

            return (
              <div
                key={idx}
                className={`min-h-[80px] border-b border-r border-border/50 p-1 ${day ? "hover:bg-card-hover" : "bg-bg/50"}`}
              >
                {day && (
                  <>
                    <span className={`text-xs ${isToday ? "bg-accent text-white rounded-full w-5 h-5 inline-flex items-center justify-center" : "text-text-muted"}`}>
                      {day}
                    </span>
                    {dayItems && (
                      <div className="mt-1 space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-1" title={item.name}>
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getDotColor(item)}`} />
                            <span className="text-[10px] text-text-muted truncate">{item.name}</span>
                          </div>
                        ))}
                        {dayItems.length > 3 && (
                          <span className="text-[10px] text-text-dim">+{dayItems.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-text-dim">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400" /> Compliant</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400" /> Due &lt;60d</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400" /> Due &lt;30d</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /> Overdue</span>
      </div>
    </div>
  );
}
