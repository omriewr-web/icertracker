import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { detectBoroId, debugFetchSource } from "@/lib/nyc-open-data";
import { assertBuildingAccess } from "@/lib/data-scope";

// GET /api/violations/test?buildingId=xxx
// or  /api/violations/test?block=02662&lot=0028&boro=2
// Returns raw debug info: the exact URL called, HTTP status, row count, sample row
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const buildingId = url.searchParams.get("buildingId");
  const manualBlock = url.searchParams.get("block");
  const manualLot = url.searchParams.get("lot");
  const manualBoro = url.searchParams.get("boro");
  const source = url.searchParams.get("source") || "HPD";

  let block: string;
  let lot: string;
  let boroId: string;
  let buildingInfo: any = {};

  if (buildingId) {
    const denied = await assertBuildingAccess(user, buildingId);
    if (denied) return denied;

    const building = await prisma.building.findUnique({
      where: { id: buildingId },
      select: { id: true, address: true, block: true, lot: true, zip: true },
    });

    if (!building) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }
    if (!building.block || !building.lot) {
      return NextResponse.json({ error: "Building missing block/lot", building }, { status: 400 });
    }

    const detectedBoro = detectBoroId(building.address, building.zip);
    if (!detectedBoro) {
      return NextResponse.json({ error: `Could not detect borough from "${building.address}" zip="${building.zip}"`, building }, { status: 400 });
    }

    block = building.block;
    lot = building.lot;
    boroId = detectedBoro;
    buildingInfo = { address: building.address, block, lot, zip: building.zip, detectedBoroId: boroId };
  } else if (manualBlock && manualLot && manualBoro) {
    block = manualBlock;
    lot = manualLot;
    boroId = manualBoro;
    buildingInfo = { manual: true, block, lot, boroId };
  } else {
    return NextResponse.json({
      error: "Provide buildingId or block+lot+boro params",
      usage: "/api/violations/test?buildingId=xxx or /api/violations/test?block=02662&lot=0028&boro=2&source=HPD",
    }, { status: 400 });
  }

  const result = await debugFetchSource(source, block, lot, boroId);

  return NextResponse.json({
    building: buildingInfo,
    debug: result,
  });
}, "compliance");
