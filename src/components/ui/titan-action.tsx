"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface TitanActionProps {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "gold" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}

export default function TitanAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  variant = "gold",
  size = "md",
  className,
  children,
}: TitanActionProps) {
  const baseStyles = "inline-flex items-center gap-2 font-medium tracking-wide uppercase transition-all duration-200 rounded-lg border";

  const variants = {
    gold: "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20 hover:border-accent/50 animate-atlas-pulse-gold",
    ghost: "bg-transparent text-text-muted border-border hover:text-text-primary hover:bg-card-hover hover:border-border-light",
    danger: "bg-atlas-red/10 text-atlas-red border-atlas-red/30 hover:bg-atlas-red/20 hover:border-atlas-red/50",
  };

  const sizes = {
    sm: "px-2.5 py-1.5 text-[11px]",
    md: "px-4 py-2 text-xs",
    lg: "px-5 py-2.5 text-sm",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children || label}
    </button>
  );
}
