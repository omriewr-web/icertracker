import { NextRequest, NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { violationSyncSchema } from "@/lib/validations";
import { syncBuildingViolations, syncAllBuildings } from "@/lib/violation-sync";
import { assertBuildingAccess } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await parseBody(req, violationSyncSchema);

  if (body.buildingId) {
    const denied = await assertBuildingAccess(user, body.buildingId);
    if (denied) return denied;
  } else if (!["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (!user.organizationId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }

  // Single building sync — fast, no streaming needed
  if (body.buildingId) {
    const results = await syncBuildingViolations(body.buildingId, body.sources);
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
    return NextResponse.json({ results, totalNew, totalUpdated });
  }

  // All buildings — stream progress via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const allResults = await syncAllBuildings(user.organizationId!, body.sources, (synced, total, batchResults) => {
          const batchNew = batchResults.reduce((s, r) => s + r.newCount, 0);
          const batchUpdated = batchResults.reduce((s, r) => s + r.updatedCount, 0);
          const batchErrors = batchResults.filter(r => r.error).length;
          send({ type: "progress", synced, total, batchNew, batchUpdated, batchErrors });
        });

        const totalNew = allResults.reduce((sum, r) => sum + r.newCount, 0);
        const totalUpdated = allResults.reduce((sum, r) => sum + r.updatedCount, 0);
        const totalErrors = allResults.filter(r => r.error).length;
        send({ type: "done", totalNew, totalUpdated, totalErrors, buildingCount: allResults.length });
      } catch (err: any) {
        send({ type: "error", message: err.message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}, "compliance");
