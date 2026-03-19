import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-card-gradient border border-border rounded-xl p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-card-gradient border border-border rounded-xl p-5 space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[250px] w-full rounded-lg" />
    </div>
  );
}

export function TablePageSkeleton({ cards = 4, rows = 8 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-card-gradient border border-border rounded-xl p-5">
        <TableSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** Compact skeleton for tab content (no page title). Stats cards + table. */
export function TabSkeleton({ cards = 5, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <TableSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** Compact skeleton for tab content with only a table (no stats). */
export function TableTabSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <Skeleton className="h-4 w-32" />
      <div className="bg-card border border-border rounded-xl p-4">
        <TableSkeleton rows={rows} />
      </div>
    </div>
  );
}

/** Skeleton for calendar/grid views. */
export function CalendarSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-6 w-full" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for scorecard/card grid views. */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-8 w-20" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
