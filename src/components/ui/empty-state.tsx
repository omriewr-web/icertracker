import { LucideIcon, Inbox } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-accent/5 flex items-center justify-center mb-3">
        <Icon className="w-8 h-8 text-text-dim" />
      </div>
      <h3 className="text-lg font-semibold text-text-muted">{title}</h3>
      {description && <p className="text-sm text-text-dim mt-1 max-w-sm">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 px-4 py-2 text-sm font-medium bg-accent/90 hover:bg-accent text-atlas-navy-1 rounded-lg transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
