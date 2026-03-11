import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { bulkCollectionAction } from "@/lib/services/collections.service";
import { z } from "zod";

const bulkSchema = z.object({
  tenantIds: z.array(z.string()).min(1),
  action: z.enum(["change_status", "add_note"]),
  value: z.string().optional(),
  note: z.string().optional(),
});

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantIds, action, value, note } = parsed.data;

  if (action === "change_status" && !value) {
    return NextResponse.json({ error: "value is required for change_status" }, { status: 400 });
  }
  if (action === "add_note" && !note) {
    return NextResponse.json({ error: "note is required for add_note" }, { status: 400 });
  }

  const result = await bulkCollectionAction(user, { tenantIds, action, value, note });
  return NextResponse.json(result);
}, "collections");
