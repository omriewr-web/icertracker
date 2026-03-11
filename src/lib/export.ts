import * as XLSX from "xlsx";

// ── Types ────────────────────────────────────────────────────

export interface ExportColumn {
  key: string;
  label: string;
}

export interface PDFConfig {
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
}

// ── Helpers ──────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resolveColumns(data: Record<string, any>[], columns?: ExportColumn[]): ExportColumn[] {
  if (columns && columns.length > 0) return columns;
  if (data.length === 0) return [];
  return Object.keys(data[0]).map((key) => ({ key, label: key }));
}

function formatCellValue(value: any): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
}

function mapRows(data: Record<string, any>[], columns: ExportColumn[]): Record<string, any>[] {
  return data.map((row) => {
    const mapped: Record<string, any> = {};
    for (const col of columns) {
      mapped[col.label] = formatCellValue(row[col.key]);
    }
    return mapped;
  });
}

// ── CSV Export ───────────────────────────────────────────────

export function exportCSV(
  data: Record<string, any>[],
  columns?: ExportColumn[],
  filename = "export"
) {
  const cols = resolveColumns(data, columns);
  if (cols.length === 0) return;

  const header = cols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const rows = data.map((row) =>
    cols
      .map((c) => {
        const val = formatCellValue(row[c.key]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csv = "\uFEFF" + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

// ── XLSX Export ──────────────────────────────────────────────

export function exportXLSX(
  data: Record<string, any>[],
  columns?: ExportColumn[],
  filename = "export"
) {
  const cols = resolveColumns(data, columns);
  if (cols.length === 0) return;

  const mapped = mapRows(data, cols);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(mapped);

  ws["!cols"] = cols.map((c) => ({
    wch: Math.max(c.label.length + 2, 14),
  }));

  const sheetName = filename.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 31) || "Export";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `${filename}.xlsx`);
}

// ── PDF Export ───────────────────────────────────────────────

export async function exportPDF(
  data: Record<string, any>[],
  columns?: ExportColumn[],
  filename = "export",
  config?: PDFConfig
) {
  const cols = resolveColumns(data, columns);
  if (cols.length === 0) return;

  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header ──
  doc.setFillColor(10, 22, 40); // Navy #0a1628
  doc.rect(0, 0, pageWidth, 60, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(201, 168, 76); // Gold #c9a84c
  doc.text("ATLAS PM", 30, 38);

  if (config?.title) {
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(config.title, 140, 38);
  }

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(dateStr, pageWidth - 30, 38, { align: "right" });

  if (config?.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(config.subtitle, 140, 52);
  }

  let startY = 75;

  // ── Stats Row ──
  if (config?.stats && config.stats.length > 0) {
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(30, startY, pageWidth - 60, 36, 4, 4, "F");

    const statWidth = (pageWidth - 60) / config.stats.length;
    config.stats.forEach((stat, i) => {
      const x = 30 + statWidth * i + statWidth / 2;

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(stat.label, x, startY + 14, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(stat.value, x, startY + 28, { align: "center" });
      doc.setFont("helvetica", "normal");
    });

    startY += 50;
  }

  // ── Data Table ──
  const head = [cols.map((c) => c.label)];
  const body = data.map((row) => cols.map((c) => formatCellValue(row[c.key])));

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: 30, right: 30 },
    styles: {
      fontSize: 8,
      cellPadding: 5,
      overflow: "linebreak",
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [10, 22, 40],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    didDrawPage: (hookData) => {
      // Footer on every page
      const pageNum = doc.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Page ${currentPage} of ${pageNum}`,
        pageWidth / 2,
        pageHeight - 20,
        { align: "center" }
      );
      doc.text("Generated by AtlasPM", pageWidth - 30, pageHeight - 20, {
        align: "right",
      });
    },
  });

  // Fix page numbers (didDrawPage doesn't know total until end)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(0, pageHeight - 30, pageWidth, 30, "F");

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 20, {
      align: "center",
    });
    doc.text("Generated by AtlasPM", pageWidth - 30, pageHeight - 20, {
      align: "right",
    });
  }

  doc.save(`${filename}.pdf`);
}

// ── Chart PNG Export ─────────────────────────────────────────

export async function exportChartPNG(
  element: HTMLElement,
  filename = "chart"
) {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(element, {
    backgroundColor: "#0a1628",
    scale: 2,
  });
  canvas.toBlob((blob) => {
    if (blob) triggerDownload(blob, `${filename}.png`);
  }, "image/png");
}
