"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, className, wide }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={cn(
          "bg-atlas-navy-3 border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] animate-slide-up",
          wide ? "w-full max-w-3xl" : "w-full max-w-lg",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="font-semibold text-text-primary font-display tracking-wide">{title}</h2>
            <button onClick={onClose} aria-label="Close dialog" className="text-text-dim hover:text-text-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
