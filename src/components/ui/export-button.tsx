"use client";

import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, Image } from "lucide-react";
import { exportCSV, exportXLSX, exportPDF, exportChartPNG } from "@/lib/export";
import type { ExportColumn, PDFConfig } from "@/lib/export";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  formats?: ("csv" | "xlsx" | "pdf")[];
  columns?: ExportColumn[];
  pdfConfig?: PDFConfig;
  chartRef?: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
  className?: string;
}

const FORMAT_OPTIONS = [
  { key: "csv" as const, label: "CSV", icon: FileText },
  { key: "xlsx" as const, label: "Excel", icon: FileSpreadsheet },
  { key: "pdf" as const, label: "PDF Report", icon: FileText },
] as const;

export default function ExportButton({
  data,
  filename,
  formats = ["csv", "xlsx", "pdf"],
  columns,
  pdfConfig,
  chartRef,
  disabled,
  className,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const dateStr = new Date().toISOString().split("T")[0];
  const fullFilename = `atlaspm-${filename}-${dateStr}`;

  async function handleExport(format: "csv" | "xlsx" | "pdf") {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }
    setExporting(true);
    setOpen(false);
    try {
      if (format === "csv") {
        exportCSV(data, columns, fullFilename);
      } else if (format === "xlsx") {
        exportXLSX(data, columns, fullFilename);
      } else {
        await exportPDF(data, columns, fullFilename, pdfConfig);
      }
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleChartExport() {
    if (!chartRef?.current) return;
    setExporting(true);
    setOpen(false);
    try {
      await exportChartPNG(chartRef.current, fullFilename);
      toast.success("Chart exported as PNG");
    } catch (err) {
      console.error("Chart export failed:", err);
      toast.error("Chart export failed");
    } finally {
      setExporting(false);
    }
  }

  const isDisabled = disabled || exporting || data.length === 0;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all active:scale-[0.98]",
          "border border-border text-text-muted hover:bg-card-hover hover:text-text-primary",
          "px-2.5 py-1 text-xs",
          "disabled:opacity-40 disabled:pointer-events-none",
          "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
        )}
      >
        <Download className="w-3.5 h-3.5" />
        {exporting ? "Exporting..." : "Export"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-card border border-border rounded-lg shadow-xl overflow-hidden animate-fade-in">
          {FORMAT_OPTIONS.filter((f) => formats.includes(f.key)).map((f) => (
            <button
              key={f.key}
              onClick={() => handleExport(f.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors"
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          ))}
          {chartRef && (
            <button
              onClick={handleChartExport}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:bg-card-hover hover:text-text-primary transition-colors border-t border-border"
            >
              <Image className="w-3.5 h-3.5" />
              Chart as PNG
            </button>
          )}
        </div>
      )}
    </div>
  );
}
