import { ProjectHealth, ProjectStatus, MilestoneStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export function calculateHealth(project: {
  approvedBudget: Decimal | null;
  actualCost: Decimal | null;
  targetEndDate: Date | null;
  status: ProjectStatus;
  milestones: { status: MilestoneStatus }[];
}): ProjectHealth {
  if (project.milestones.some((m) => m.status === "BLOCKED")) return "BLOCKED";
  if (project.approvedBudget && project.actualCost) {
    if (Number(project.actualCost) > Number(project.approvedBudget) * 1.05) return "OVER_BUDGET";
  }
  const done: string[] = ["COMPLETED", "CLOSED", "CANCELLED"];
  if (project.targetEndDate && new Date() > project.targetEndDate && !done.includes(project.status)) return "DELAYED";
  if (project.targetEndDate) {
    const daysLeft = (project.targetEndDate.getTime() - Date.now()) / 86400000;
    const total = project.milestones.length;
    const completed = project.milestones.filter((m) => m.status === "COMPLETED").length;
    if (daysLeft < 7 && total > 0 && completed / total < 0.8) return "AT_RISK";
  }
  return "ON_TRACK";
}

export function calculatePercentComplete(milestones: { status: MilestoneStatus }[]): number {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter((m) => m.status === "COMPLETED").length / milestones.length) * 100);
}
