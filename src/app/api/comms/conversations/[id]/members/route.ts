import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { addGroupMembers, removeGroupMember } from "@/lib/comms/conversation.service";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await req.json();
  await addGroupMembers(user.organizationId!, id, user.id, body.memberIds);
  return NextResponse.json({ success: true });
}, "dash");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const body = await req.json();
  await removeGroupMember(user.organizationId!, id, user.id, body.userId);
  return NextResponse.json({ success: true });
}, "dash");
