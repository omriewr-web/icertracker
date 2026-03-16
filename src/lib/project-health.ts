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

export interface ProjectStats {
  totalMilestones: number;
  completedMilestones: number;
  blockedMilestones: number;
  overdueMilestones: number;
  percentComplete: number;
  totalApprovedBudget: number;
  totalEstimatedBudget: number;
  totalActualCost: number;
  variance: number;
  variancePct: number;
  daysRemaining: number | null;
  daysElapsed: number | null;
  isOverdue: boolean;
  health: string;
  nextAction: string;
}

export function computeProjectStats(project: {
  status: string;
  approvedBudget: any;
  estimatedBudget: any;
  actualCost: any;
  targetEndDate: Date | string | null;
  startDate: Date | string | null;
  requiresApproval: boolean;
  percentComplete: number;
  milestones: { status: string; dueDate?: Date | string | null; name: string }[];
}): ProjectStats {
  const toNum = (v: any): number => v === null || v === undefined ? 0 : Number(v);

  const totalMilestones = project.milestones.length;
  const completedMilestones = project.milestones.filter(m => m.status === 'COMPLETED').length;
  const blockedMilestones = project.milestones.filter(m => m.status === 'BLOCKED').length;
  const now = new Date();
  const overdueMilestones = project.milestones.filter(m =>
    m.status !== 'COMPLETED' && m.dueDate && new Date(m.dueDate) < now
  ).length;

  const percentComplete = totalMilestones > 0
    ? Math.round(completedMilestones / totalMilestones * 100)
    : project.percentComplete;

  const totalApprovedBudget = toNum(project.approvedBudget);
  const totalEstimatedBudget = toNum(project.estimatedBudget);
  const totalActualCost = toNum(project.actualCost);
  const budgetBase = totalApprovedBudget || totalEstimatedBudget;
  const variance = budgetBase - totalActualCost;
  const variancePct = budgetBase > 0 ? Math.round(variance / budgetBase * 100) : 0;

  const targetEnd = project.targetEndDate ? new Date(project.targetEndDate) : null;
  const startD = project.startDate ? new Date(project.startDate) : null;
  const done = ['COMPLETED', 'CLOSED', 'CANCELLED'];
  const isOverdue = !!targetEnd && now > targetEnd && !done.includes(project.status);
  const daysRemaining = targetEnd ? Math.ceil((targetEnd.getTime() - now.getTime()) / 86400000) : null;
  const daysElapsed = startD ? Math.ceil((now.getTime() - startD.getTime()) / 86400000) : null;

  let health: string = 'ON_TRACK';
  if (blockedMilestones > 0) health = 'BLOCKED';
  else if (totalActualCost > budgetBase && budgetBase > 0) health = 'OVER_BUDGET';
  else if (isOverdue) health = 'DELAYED';
  else if (targetEnd && daysRemaining !== null && daysRemaining < 7 && daysRemaining >= 0 && totalMilestones > 0 && completedMilestones / totalMilestones < 0.8) health = 'AT_RISK';

  let nextAction = 'Continue execution';
  const blockedMs = project.milestones.find(m => m.status === 'BLOCKED');
  if (project.status === 'PENDING_APPROVAL') nextAction = 'Waiting for approval';
  else if (blockedMs) nextAction = `Resolve blocked milestone: ${blockedMs.name}`;
  else if (isOverdue) nextAction = 'Project is overdue — update timeline or close';
  else if (totalActualCost > budgetBase && budgetBase > 0) nextAction = 'Review budget overrun';
  else if (completedMilestones === totalMilestones && totalMilestones > 0 && !done.includes(project.status)) nextAction = 'All milestones done — ready to close';
  else if (totalMilestones === 0) nextAction = 'Add milestones to track progress';

  return {
    totalMilestones, completedMilestones, blockedMilestones, overdueMilestones,
    percentComplete, totalApprovedBudget, totalEstimatedBudget, totalActualCost,
    variance, variancePct, daysRemaining, daysElapsed, isOverdue, health, nextAction,
  };
}
