import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export const GET = withAuth(async () => {
  // Dynamic import xlsx
  const XLSX = await import("xlsx");

  const headers = [
    "Building Address",
    "Block",
    "Lot",
    "Unit Number",
    "Legal Rent",
    "Preferential Rent",
    "Is Rent Stabilized",
    "DHCR Registration ID",
  ];

  const exampleRow = [
    "123 Main Street",
    "01234",
    "0056",
    "4A",
    "1500.00",
    "1350.00",
    "yes",
    "DR-12345",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Legal Rent Import");

  // Set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="legal-rent-import-template.xlsx"',
    },
  });
}, "upload");
