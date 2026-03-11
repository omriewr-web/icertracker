import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { assertWorkOrderAccess } from "@/lib/data-scope";
import { supabaseAdmin, BUCKET_NAME, validateImageFile, getPublicUrl } from "@/lib/supabase-storage";

export const POST = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  const denied = await assertWorkOrderAccess(user, id);
  if (denied) return denied;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > 5) {
    return NextResponse.json({ error: "Maximum 5 photos per request" }, { status: 400 });
  }

  const photoUrls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const validationError = validateImageFile(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `work-orders/${id}/${timestamp}-${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      errors.push(`Upload failed for ${file.name}: ${uploadError.message}`);
      continue;
    }

    photoUrls.push(getPublicUrl(path));
  }

  if (photoUrls.length === 0) {
    return NextResponse.json({ error: "No files uploaded successfully", details: errors }, { status: 400 });
  }

  // Create a comment with the photo URLs
  const comment = await prisma.workOrderComment.create({
    data: {
      workOrderId: id,
      authorId: user.id,
      text: `Uploaded ${photoUrls.length} photo${photoUrls.length !== 1 ? "s" : ""}`,
      photos: photoUrls,
    },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json({ comment, errors: errors.length > 0 ? errors : undefined }, { status: 201 });
}, "maintenance");
