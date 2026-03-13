import { prisma } from "@/lib/prisma";
import { triageWorkOrderTrade } from "@/lib/ai/asset-manager";

/**
 * Auto-create a WorkOrder when an InspectionItem is marked as "fail".
 *
 * Call this after updating an InspectionItem's status to "fail".
 * Idempotent — uses generatedWorkOrderId to prevent duplicates.
 */
export async function handleInspectionItemFailure(
  inspectionItemId: string,
): Promise<{ workOrderId: string } | null> {
  const item = await prisma.inspectionItem.findUnique({
    where: { id: inspectionItemId },
    select: {
      id: true,
      label: true,
      notes: true,
      generatedWorkOrderId: true,
      buildingId: true,
      unitId: true,
      inspection: {
        select: {
          id: true,
          inspectionType: true,
          building: { select: { address: true } },
        },
      },
    },
  });

  if (!item || !item.buildingId) return null;

  // Already has a generated WO
  if (item.generatedWorkOrderId) return { workOrderId: item.generatedWorkOrderId };

  const description = [
    `Auto-created from inspection failure.`,
    `Item: ${item.label}`,
    item.notes ? `Notes: ${item.notes}` : null,
    `Inspection: ${item.inspection?.inspectionType || "Unknown"} (${item.inspection?.building?.address || ""})`,
  ].filter(Boolean).join("\n");

  const trade = triageWorkOrderTrade(description);

  const wo = await prisma.workOrder.create({
    data: {
      title: `[INSP] ${item.label} — failed`,
      description,
      status: "OPEN",
      priority: "HIGH",
      category: "GENERAL",
      trade,
      buildingId: item.buildingId,
      unitId: item.unitId,
    },
  });

  // Link the WO back to the inspection item
  await prisma.inspectionItem.update({
    where: { id: inspectionItemId },
    data: { generatedWorkOrderId: wo.id },
  });

  return { workOrderId: wo.id };
}
