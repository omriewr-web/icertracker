import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getBuildingIdScope, EMPTY_SCOPE } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (_req, { user }) => {
  const scope = getBuildingIdScope(user);
  if (scope === EMPTY_SCOPE) return NextResponse.json({ geocoded: 0, total: 0 });

  const buildings = await prisma.building.findMany({
    where: { ...(scope as object), lat: null },
    select: { id: true, address: true, city: true, state: true },
  });

  let geocoded = 0;
  for (const b of buildings) {
    try {
      const q = encodeURIComponent(`${b.address} ${b.city || "New York"} ${b.state || "NY"}`);
      const res = await fetch(
        `https://geosearch.planninglabs.nyc/v2/search?text=${q}&size=1`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      const coords = data?.features?.[0]?.geometry?.coordinates;
      if (coords) {
        await prisma.building.update({
          where: { id: b.id },
          data: { lat: coords[1], lng: coords[0] },
        });
        geocoded++;
      }
    } catch {
      // skip failed geocodes
    }
    await new Promise((r) => setTimeout(r, 60));
  }

  return NextResponse.json({ geocoded, total: buildings.length });
}, "dash");
