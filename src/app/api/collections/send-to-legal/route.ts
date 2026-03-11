import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { sendToLegal } from "@/lib/services/collections.service";
import { z } from "zod";

const schema = z.object({
  tenantId: z.string().min(1),
});

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await sendToLegal(user, parsed.data.tenantId);
  return NextResponse.json(result);
}, "collections");
