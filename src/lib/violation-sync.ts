import { prisma } from "./prisma";
import {
  detectBoroId,
  fetchHpdViolations,
  fetchDobViolations,
  fetchEcbViolations,
  fetchHpdComplaints,
  mapHpdViolation,
  mapDobViolation,
  mapEcbViolation,
  mapHpdComplaint,
} from "./nyc-open-data";
import type { FetchResult } from "./nyc-open-data";

type Source = "HPD" | "DOB" | "ECB" | "HPD_COMPLAINTS";

/**
 * Auto-create an URGENT work order for a Class C / Immediately Hazardous violation.
 * Uses the violationId FK on WorkOrder (preferred) and also back-links via linkedWorkOrderId.
 */
async function autoCreateUrgentWorkOrder(
  violationId: string,
  buildingId: string,
  source: string,
  externalId: string,
  description: string,
): Promise<void> {
  // Check for existing WO already linked via violationId FK
  const existingWo = await prisma.workOrder.findFirst({
    where: { violationId },
    select: { id: true },
  });
  if (existingWo) return;

  const wo = await prisma.workOrder.create({
    data: {
      title: `[AUTO] ${source} Violation - ${externalId}`,
      description: `Auto-created from ${source} violation.\n\n${description}`,
      status: "OPEN",
      priority: "URGENT",
      category: "GENERAL",
      buildingId,
      violationId,
    },
  });
  await prisma.violation.update({
    where: { id: violationId },
    data: { linkedWorkOrderId: wo.id },
  });
}

interface SyncResult {
  buildingId: string;
  address: string;
  source: string;
  newCount: number;
  updatedCount: number;
  rowsFetched: number;
  apiUrl?: string;
  error?: string;
}

export async function syncBuildingViolations(
  buildingId: string,
  sources?: string[]
): Promise<SyncResult[]> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, address: true, block: true, lot: true, zip: true },
  });

  if (!building || !building.block || !building.lot) {
    console.log(`[Sync] Skipping building ${buildingId}: missing block/lot`);
    return [{ buildingId, address: building?.address || "", source: "ALL", newCount: 0, updatedCount: 0, rowsFetched: 0, error: "Missing block/lot" }];
  }

  const boroId = detectBoroId(building.address, building.zip);
  if (!boroId) {
    console.log(`[Sync] Skipping building ${building.address}: could not detect borough`);
    return [{ buildingId, address: building.address, source: "ALL", newCount: 0, updatedCount: 0, rowsFetched: 0, error: `Could not detect borough from address "${building.address}" zip "${building.zip}"` }];
  }

  console.log(`[Sync] Building: ${building.address} | block=${building.block} lot=${building.lot} boroId=${boroId}`);

  const activeSources: Source[] = (sources?.length
    ? sources.filter((s): s is Source => ["HPD", "DOB", "ECB", "HPD_COMPLAINTS"].includes(s))
    : ["HPD", "DOB", "ECB", "HPD_COMPLAINTS"]);

  const results: SyncResult[] = [];

  for (const source of activeSources) {
    let newCount = 0;
    let updatedCount = 0;
    try {
      let fetchResult: FetchResult;
      let mapper: (row: any, bid: string) => any;

      switch (source) {
        case "HPD":
          fetchResult = await fetchHpdViolations(building.block, building.lot, boroId);
          mapper = mapHpdViolation;
          break;
        case "DOB":
          fetchResult = await fetchDobViolations(building.block, building.lot, boroId);
          mapper = mapDobViolation;
          break;
        case "ECB":
          fetchResult = await fetchEcbViolations(building.block, building.lot, boroId);
          mapper = mapEcbViolation;
          break;
        case "HPD_COMPLAINTS":
          fetchResult = await fetchHpdComplaints(building.block, building.lot, boroId);
          mapper = mapHpdComplaint;
          break;
      }

      const rows = fetchResult!.rows;

      if (fetchResult!.error) {
        console.error(`[Sync] ${source} API error: ${fetchResult!.error}`);
        results.push({ buildingId, address: building.address, source, newCount: 0, updatedCount: 0, rowsFetched: 0, apiUrl: fetchResult!.url, error: fetchResult!.error });
        continue;
      }

      console.log(`[Sync] ${source}: ${rows.length} rows fetched`);

      for (const row of rows) {
        const mapped = mapper!(row, buildingId);
        if (!mapped.where.source_externalId.externalId) continue;

        const existing = await prisma.violation.findUnique({ where: mapped.where });

        if (existing) {
          await prisma.violation.update({ where: { id: existing.id }, data: mapped.update });
          updatedCount++;

          // Auto-create work order if violation is now Class C / Immediately Hazardous
          if (mapped.update.class === "C" || mapped.update.severity === "IMMEDIATELY_HAZARDOUS") {
            await autoCreateUrgentWorkOrder(
              existing.id, buildingId, source, existing.externalId,
              mapped.update.description || existing.novDescription || "",
            );
          }
        } else {
          const created = await prisma.violation.create({ data: mapped.create });
          newCount++;

          // Auto-create work order for Class C / Immediately Hazardous
          if (mapped.create.class === "C" || mapped.create.severity === "IMMEDIATELY_HAZARDOUS") {
            await autoCreateUrgentWorkOrder(
              created.id, buildingId, source, mapped.create.externalId,
              mapped.create.description || mapped.create.novDescription || "",
            );
          }
        }
      }

      await prisma.violationSyncLog.create({
        data: { buildingId, source, newCount, updatedCount, status: "completed" },
      });

      console.log(`[Sync] ${source} done: ${newCount} new, ${updatedCount} updated`);
      results.push({ buildingId, address: building.address, source, newCount, updatedCount, rowsFetched: rows.length, apiUrl: fetchResult!.url });
    } catch (err: any) {
      console.error(`[Sync] Error for ${source} on ${building.address}:`, err);
      await prisma.violationSyncLog.create({
        data: { buildingId, source, newCount: 0, updatedCount: 0, status: `error: ${err.message}` },
      });
      results.push({ buildingId, address: building.address, source, newCount: 0, updatedCount: 0, rowsFetched: 0, error: err.message });
    }
  }

  return results;
}

const BATCH_SIZE = 10;

export async function syncAllBuildings(
  sources?: string[],
  onProgress?: (synced: number, total: number, batchResults: SyncResult[]) => void
): Promise<SyncResult[]> {
  const buildings = await prisma.building.findMany({
    where: {
      block: { not: null },
      lot: { not: null },
    },
    select: { id: true },
  });

  const total = buildings.length;
  console.log(`[Sync] Syncing ${total} buildings with block/lot data (batch size ${BATCH_SIZE})`);

  const allResults: SyncResult[] = [];

  for (let i = 0; i < buildings.length; i += BATCH_SIZE) {
    const batch = buildings.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((b) => syncBuildingViolations(b.id, sources).catch((err) => {
        console.error(`[Sync] Building ${b.id} failed:`, err);
        return [{ buildingId: b.id, address: "", source: "ALL", newCount: 0, updatedCount: 0, rowsFetched: 0, error: err.message }] as SyncResult[];
      }))
    );
    const flatResults = batchResults.flat();
    allResults.push(...flatResults);
    const synced = Math.min(i + BATCH_SIZE, total);
    console.log(`[Sync] Progress: ${synced}/${total} buildings`);
    if (onProgress) onProgress(synced, total, flatResults);
  }

  return allResults;
}
