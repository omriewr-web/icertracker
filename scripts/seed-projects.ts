import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

// Building IDs
const B = {
  edgecombe: "cmml8gkss05y8l7oewwm172n6",
  w155: "cmml8fw3j05lml7oe3lbtgw10",
  w125: "cmml8ep8x04xal7oemz088ugz",
  bailey: "cmml87rqy012cl7oezopyn2ku",
  aqueduct: "cmml8a0tm02d0l7oeljouf02a",
  burnside: "cmml8al2o02oel7oewf50mmc6",
  prospect: "cmml8snfc0caal7oe8a9exsgp",
  overlook: "cmml8qlkt0b4gl7oefcoyaysb",
};

interface ProjectSeed {
  id: string;
  name: string;
  buildingId: string;
  category: string;
  status: string;
  priority: string;
  health: string;
  estimatedBudget?: number;
  approvedBudget?: number | null;
  actualCost?: number;
  percentComplete?: number;
  startDate?: Date | null;
  targetEndDate?: Date | null;
  actualEndDate?: Date | null;
  ownerVisible?: boolean;
  requiresApproval?: boolean;
  description?: string;
  milestones?: { id: string; name: string; status: string; dueDate?: Date | null; completedAt?: Date | null }[];
  budgetLines?: { id: string; category: string; estimated: number; actual?: number }[];
  changeOrders?: { id: string; title: string; amount: number; status: string; approvedAt?: Date | null }[];
  activities?: { id: string; action: string; detail?: string; createdAt: Date }[];
}

const projects: ProjectSeed[] = [
  {
    id: "seed-project-001", name: "Boiler Replacement — Building 1", buildingId: B.edgecombe,
    category: "BOILER", status: "IN_PROGRESS", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 45000, approvedBudget: 48000, actualCost: 22000, percentComplete: 55,
    startDate: daysAgo(60), targetEndDate: daysFromNow(30), ownerVisible: true,
    description: "Full boiler replacement for building 1. Old cast iron unit replaced with high-efficiency gas-fired system.",
    milestones: [
      { id: "seed-ms-001a", name: "Engineering assessment", status: "COMPLETED", completedAt: daysAgo(50) },
      { id: "seed-ms-001b", name: "Permits filed", status: "COMPLETED", completedAt: daysAgo(40) },
      { id: "seed-ms-001c", name: "Boiler removal", status: "COMPLETED", completedAt: daysAgo(20) },
      { id: "seed-ms-001d", name: "New boiler installation", status: "IN_PROGRESS", dueDate: daysFromNow(15) },
    ],
    budgetLines: [
      { id: "seed-bl-001a", category: "Equipment", estimated: 32000, actual: 32000 },
      { id: "seed-bl-001b", category: "Labor", estimated: 12000, actual: 8000 },
      { id: "seed-bl-001c", category: "Permits", estimated: 2000, actual: 1500 },
    ],
    activities: [
      { id: "seed-act-001a", action: "PROJECT_APPROVED", detail: "Project approved for execution", createdAt: daysAgo(62) },
      { id: "seed-act-001b", action: "PROJECT_UPDATED", detail: "Status → IN_PROGRESS", createdAt: daysAgo(60) },
      { id: "seed-act-001c", action: "MILESTONE_UPDATED", detail: '"Engineering assessment" → COMPLETED', createdAt: daysAgo(50) },
    ],
  },
  {
    id: "seed-project-002", name: "Facade Inspection & Repair — LL11", buildingId: B.w155,
    category: "FACADE", status: "IN_PROGRESS", priority: "CRITICAL", health: "AT_RISK",
    estimatedBudget: 85000, approvedBudget: 90000, actualCost: 71000, percentComplete: 60,
    startDate: daysAgo(90), targetEndDate: daysFromNow(5), ownerVisible: true,
    milestones: [
      { id: "seed-ms-002a", name: "Scaffold installation", status: "COMPLETED", completedAt: daysAgo(80) },
      { id: "seed-ms-002b", name: "Initial inspection", status: "COMPLETED", completedAt: daysAgo(70) },
      { id: "seed-ms-002c", name: "Repair north facade", status: "COMPLETED", completedAt: daysAgo(30) },
      { id: "seed-ms-002d", name: "Repair south facade", status: "IN_PROGRESS", dueDate: daysAgo(10) },
      { id: "seed-ms-002e", name: "Final DOB inspection", status: "PENDING", dueDate: daysFromNow(3) },
    ],
    activities: [
      { id: "seed-act-002a", action: "PROJECT_UPDATED", detail: "Status → IN_PROGRESS", createdAt: daysAgo(88) },
      { id: "seed-act-002b", action: "MILESTONE_UPDATED", detail: '"Scaffold installation" → COMPLETED', createdAt: daysAgo(80) },
    ],
  },
  {
    id: "seed-project-003", name: "Roof Replacement", buildingId: B.bailey,
    category: "ROOF", status: "IN_PROGRESS", priority: "HIGH", health: "OVER_BUDGET",
    estimatedBudget: 120000, approvedBudget: 130000, actualCost: 142000, percentComplete: 85,
    startDate: daysAgo(180), targetEndDate: daysAgo(30), ownerVisible: true,
    milestones: [
      { id: "seed-ms-003a", name: "Structural assessment", status: "COMPLETED", completedAt: daysAgo(170) },
      { id: "seed-ms-003b", name: "Material procurement", status: "COMPLETED", completedAt: daysAgo(150) },
      { id: "seed-ms-003c", name: "Demo old roof", status: "COMPLETED", completedAt: daysAgo(120) },
      { id: "seed-ms-003d", name: "Install new membrane", status: "COMPLETED", completedAt: daysAgo(60) },
      { id: "seed-ms-003e", name: "Final waterproofing & inspection", status: "BLOCKED" },
    ],
    changeOrders: [
      { id: "seed-co-003a", title: "Unforeseen structural damage", amount: 8000, status: "APPROVED", approvedAt: daysAgo(100) },
      { id: "seed-co-003b", title: "Material cost increase", amount: 12000, status: "APPROVED", approvedAt: daysAgo(80) },
    ],
    activities: [
      { id: "seed-act-003a", action: "PROJECT_UPDATED", detail: "Status → IN_PROGRESS", createdAt: daysAgo(178) },
      { id: "seed-act-003b", action: "CHANGE_ORDER_CREATED", detail: '"Unforeseen structural damage" — $8,000', createdAt: daysAgo(100) },
      { id: "seed-act-003c", action: "MILESTONE_UPDATED", detail: '"Final waterproofing & inspection" → BLOCKED', createdAt: daysAgo(15) },
    ],
  },
  {
    id: "seed-project-004", name: "Lead Paint Remediation — Unit 4A", buildingId: B.aqueduct,
    category: "VIOLATION_REMEDIATION", status: "IN_PROGRESS", priority: "CRITICAL", health: "BLOCKED",
    estimatedBudget: 25000, approvedBudget: 28000, actualCost: 8000, percentComplete: 30,
    startDate: daysAgo(45), targetEndDate: daysFromNow(60), ownerVisible: false,
    milestones: [
      { id: "seed-ms-004a", name: "XRF Testing", status: "COMPLETED", completedAt: daysAgo(40) },
      { id: "seed-ms-004b", name: "HPD Order to Repair received", status: "COMPLETED", completedAt: daysAgo(35) },
      { id: "seed-ms-004c", name: "Contractor scope approval", status: "BLOCKED" },
      { id: "seed-ms-004d", name: "Remediation work", status: "PENDING", dueDate: daysFromNow(30) },
    ],
    activities: [
      { id: "seed-act-004a", action: "PROJECT_CREATED", detail: "Project created from HPD violation", createdAt: daysAgo(45) },
      { id: "seed-act-004b", action: "MILESTONE_UPDATED", detail: '"Contractor scope approval" → BLOCKED', createdAt: daysAgo(10) },
    ],
  },
  {
    id: "seed-project-005", name: "Common Area Renovation — Lobby & Hallways", buildingId: B.burnside,
    category: "COMMON_AREA", status: "PENDING_APPROVAL", priority: "MEDIUM", health: "ON_TRACK",
    estimatedBudget: 65000, approvedBudget: null, actualCost: 0, percentComplete: 0,
    startDate: null, targetEndDate: daysFromNow(120), requiresApproval: true, ownerVisible: true,
    milestones: [
      { id: "seed-ms-005a", name: "Design & material selection", status: "PENDING" },
      { id: "seed-ms-005b", name: "Flooring installation", status: "PENDING" },
      { id: "seed-ms-005c", name: "Paint & lighting", status: "PENDING" },
      { id: "seed-ms-005d", name: "Punch list & final walkthrough", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-005a", action: "PROJECT_CREATED", detail: "Project created", createdAt: daysAgo(5) },
    ],
  },
  {
    id: "seed-project-006", name: "Plumbing Stack Repair — Floors 3-6", buildingId: B.prospect,
    category: "PLUMBING", status: "COMPLETED", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 38000, approvedBudget: 40000, actualCost: 34500, percentComplete: 100,
    startDate: daysAgo(120), targetEndDate: daysAgo(60), actualEndDate: daysAgo(65), ownerVisible: true,
    milestones: [
      { id: "seed-ms-006a", name: "Video inspection", status: "COMPLETED", completedAt: daysAgo(110) },
      { id: "seed-ms-006b", name: "Temporary bypass", status: "COMPLETED", completedAt: daysAgo(100) },
      { id: "seed-ms-006c", name: "Stack replacement", status: "COMPLETED", completedAt: daysAgo(75) },
      { id: "seed-ms-006d", name: "Final testing & restoration", status: "COMPLETED", completedAt: daysAgo(65) },
    ],
    activities: [
      { id: "seed-act-006a", action: "PROJECT_UPDATED", detail: "Status → COMPLETED — under budget by $5,500", createdAt: daysAgo(65) },
    ],
  },
  {
    id: "seed-project-007", name: "Electrical Panel Upgrade — Building Wide", buildingId: B.overlook,
    category: "ELECTRICAL", status: "PLANNED", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 95000, approvedBudget: null, actualCost: 0, percentComplete: 0,
    startDate: daysFromNow(30), targetEndDate: daysFromNow(180), ownerVisible: true,
    milestones: [
      { id: "seed-ms-007a", name: "Engineering assessment", status: "PENDING" },
      { id: "seed-ms-007b", name: "DOB permit filing", status: "PENDING" },
      { id: "seed-ms-007c", name: "Panel replacement — floors 1-4", status: "PENDING" },
      { id: "seed-ms-007d", name: "Panel replacement — floors 5-8", status: "PENDING" },
      { id: "seed-ms-007e", name: "Final inspection & sign-off", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-007a", action: "PROJECT_CREATED", detail: "Project created", createdAt: daysAgo(3) },
    ],
  },
  {
    id: "seed-project-008", name: "Local Law 97 Energy Compliance Study", buildingId: B.w125,
    category: "LOCAL_LAW", status: "ESTIMATING", priority: "CRITICAL", health: "ON_TRACK",
    estimatedBudget: 15000, approvedBudget: null, actualCost: 0, percentComplete: 0,
    targetEndDate: daysFromNow(90), ownerVisible: true,
    milestones: [
      { id: "seed-ms-008a", name: "Energy audit", status: "PENDING" },
      { id: "seed-ms-008b", name: "Compliance report", status: "PENDING" },
      { id: "seed-ms-008c", name: "Remediation plan", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-008a", action: "PROJECT_CREATED", detail: "Project created for LL97 compliance", createdAt: daysAgo(7) },
    ],
  },
  {
    id: "seed-project-009", name: "Apartment Renovation — Unit 12B Turnover", buildingId: B.edgecombe,
    category: "APARTMENT_RENO", status: "IN_PROGRESS", priority: "MEDIUM", health: "ON_TRACK",
    estimatedBudget: 22000, approvedBudget: 22000, actualCost: 14000, percentComplete: 65,
    startDate: daysAgo(25), targetEndDate: daysFromNow(15), ownerVisible: false,
    milestones: [
      { id: "seed-ms-009a", name: "Demo & cleanup", status: "COMPLETED", completedAt: daysAgo(20) },
      { id: "seed-ms-009b", name: "Paint & flooring", status: "COMPLETED", completedAt: daysAgo(12) },
      { id: "seed-ms-009c", name: "Kitchen & bath updates", status: "IN_PROGRESS", dueDate: daysFromNow(5) },
      { id: "seed-ms-009d", name: "Final punch list", status: "PENDING", dueDate: daysFromNow(12) },
    ],
    activities: [
      { id: "seed-act-009a", action: "PROJECT_UPDATED", detail: "Status → IN_PROGRESS", createdAt: daysAgo(25) },
    ],
  },
  {
    id: "seed-project-010", name: "Emergency Heating System Repair", buildingId: B.bailey,
    category: "EMERGENCY", status: "SUBSTANTIALLY_COMPLETE", priority: "CRITICAL", health: "ON_TRACK",
    estimatedBudget: 18000, approvedBudget: 20000, actualCost: 19200, percentComplete: 95,
    startDate: daysAgo(15), targetEndDate: daysAgo(5), ownerVisible: true,
    milestones: [
      { id: "seed-ms-010a", name: "Emergency diagnosis", status: "COMPLETED", completedAt: daysAgo(14) },
      { id: "seed-ms-010b", name: "Parts procurement & repair", status: "COMPLETED", completedAt: daysAgo(8) },
      { id: "seed-ms-010c", name: "System test & sign-off", status: "IN_PROGRESS" },
    ],
    activities: [
      { id: "seed-act-010a", action: "PROJECT_CREATED", detail: "Emergency — no heat reported", createdAt: daysAgo(15) },
    ],
  },
  {
    id: "seed-project-011", name: "Building-Wide Window Replacement", buildingId: B.overlook,
    category: "CAPITAL_IMPROVEMENT", status: "APPROVED", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 280000, approvedBudget: 295000, actualCost: 0, percentComplete: 0,
    startDate: daysFromNow(14), targetEndDate: daysFromNow(365), ownerVisible: true, requiresApproval: true,
    milestones: [
      { id: "seed-ms-011a", name: "Contract execution", status: "PENDING" },
      { id: "seed-ms-011b", name: "Material procurement", status: "PENDING" },
      { id: "seed-ms-011c", name: "Floors 1-3 installation", status: "PENDING" },
      { id: "seed-ms-011d", name: "Floors 4-6 installation", status: "PENDING" },
      { id: "seed-ms-011e", name: "Floors 7-9 installation", status: "PENDING" },
      { id: "seed-ms-011f", name: "Final inspection & punch list", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-011a", action: "PROJECT_APPROVED", detail: "Approved by admin", createdAt: daysAgo(2) },
    ],
  },
  {
    id: "seed-project-012", name: "HPD Class C Violation — Mold Remediation 3F", buildingId: B.prospect,
    category: "VIOLATION_REMEDIATION", status: "IN_PROGRESS", priority: "CRITICAL", health: "ON_TRACK",
    estimatedBudget: 12000, approvedBudget: 12000, actualCost: 6500, percentComplete: 50,
    startDate: daysAgo(20), targetEndDate: daysFromNow(20), ownerVisible: false,
    milestones: [
      { id: "seed-ms-012a", name: "IEP inspection", status: "COMPLETED", completedAt: daysAgo(18) },
      { id: "seed-ms-012b", name: "Containment setup", status: "COMPLETED", completedAt: daysAgo(15) },
      { id: "seed-ms-012c", name: "Remediation work", status: "IN_PROGRESS", dueDate: daysFromNow(10) },
      { id: "seed-ms-012d", name: "Post-remediation clearance test", status: "PENDING", dueDate: daysFromNow(18) },
    ],
    activities: [
      { id: "seed-act-012a", action: "PROJECT_CREATED", detail: "Created from HPD Class C violation", createdAt: daysAgo(20) },
    ],
  },
  {
    id: "seed-project-013", name: "Elevator Modernization", buildingId: B.aqueduct,
    category: "CAPITAL_IMPROVEMENT", status: "IN_PROGRESS", priority: "HIGH", health: "DELAYED",
    estimatedBudget: 175000, approvedBudget: 185000, actualCost: 95000, percentComplete: 45,
    startDate: daysAgo(200), targetEndDate: daysAgo(60), ownerVisible: true,
    milestones: [
      { id: "seed-ms-013a", name: "Engineering & permits", status: "COMPLETED", completedAt: daysAgo(180) },
      { id: "seed-ms-013b", name: "Equipment procurement", status: "COMPLETED", completedAt: daysAgo(140) },
      { id: "seed-ms-013c", name: "Cab removal & shaft prep", status: "COMPLETED", completedAt: daysAgo(100) },
      { id: "seed-ms-013d", name: "New equipment installation", status: "IN_PROGRESS", dueDate: daysAgo(30) },
      { id: "seed-ms-013e", name: "DOB inspection & sign-off", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-013a", action: "PROJECT_UPDATED", detail: "Status → IN_PROGRESS", createdAt: daysAgo(198) },
      { id: "seed-act-013b", action: "PROJECT_UPDATED", detail: "Health → DELAYED — past target end date", createdAt: daysAgo(60) },
    ],
  },
  {
    id: "seed-project-014", name: "Roof Garden & Terrace Waterproofing", buildingId: B.burnside,
    category: "ROOF", status: "ESTIMATING", priority: "MEDIUM", health: "ON_TRACK",
    estimatedBudget: 55000, approvedBudget: null, actualCost: 0,
    targetEndDate: daysFromNow(150), ownerVisible: true,
    activities: [
      { id: "seed-act-014a", action: "PROJECT_CREATED", detail: "Project created", createdAt: daysAgo(10) },
    ],
  },
  {
    id: "seed-project-015", name: "Fire Escape Inspection & Repair — LL11", buildingId: B.w125,
    category: "FACADE", status: "CLOSED", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 28000, approvedBudget: 30000, actualCost: 27500, percentComplete: 100,
    startDate: daysAgo(240), actualEndDate: daysAgo(90), ownerVisible: true,
    milestones: [
      { id: "seed-ms-015a", name: "Inspection", status: "COMPLETED", completedAt: daysAgo(220) },
      { id: "seed-ms-015b", name: "Repair work", status: "COMPLETED", completedAt: daysAgo(130) },
      { id: "seed-ms-015c", name: "Final DOB sign-off", status: "COMPLETED", completedAt: daysAgo(90) },
    ],
    activities: [
      { id: "seed-act-015a", action: "PROJECT_UPDATED", detail: "Status → CLOSED — under budget by $2,500", createdAt: daysAgo(90) },
    ],
  },
  {
    id: "seed-project-016", name: "Community Room Renovation", buildingId: B.w155,
    category: "COMMON_AREA", status: "PAUSED", priority: "LOW", health: "AT_RISK",
    estimatedBudget: 45000, approvedBudget: 45000, actualCost: 12000, percentComplete: 25,
    startDate: daysAgo(90), targetEndDate: daysAgo(30), ownerVisible: true,
    milestones: [
      { id: "seed-ms-016a", name: "Design approval", status: "COMPLETED", completedAt: daysAgo(80) },
      { id: "seed-ms-016b", name: "Demo work", status: "COMPLETED", completedAt: daysAgo(60) },
      { id: "seed-ms-016c", name: "Construction", status: "BLOCKED" },
      { id: "seed-ms-016d", name: "Finishing & punch list", status: "PENDING" },
    ],
    activities: [
      { id: "seed-act-016a", action: "PROJECT_UPDATED", detail: "Status → PAUSED — contractor dispute", createdAt: daysAgo(30) },
    ],
  },
  {
    id: "seed-project-017", name: "Annual Boiler Maintenance & Inspection", buildingId: B.bailey,
    category: "BOILER", status: "COMPLETED", priority: "MEDIUM", health: "ON_TRACK",
    estimatedBudget: 8500, approvedBudget: 9000, actualCost: 8200, percentComplete: 100,
    startDate: daysAgo(45), actualEndDate: daysAgo(30), ownerVisible: false,
    milestones: [
      { id: "seed-ms-017a", name: "Inspection & testing", status: "COMPLETED", completedAt: daysAgo(38) },
      { id: "seed-ms-017b", name: "Tune-up & certification", status: "COMPLETED", completedAt: daysAgo(30) },
    ],
    activities: [
      { id: "seed-act-017a", action: "PROJECT_UPDATED", detail: "Status → COMPLETED", createdAt: daysAgo(30) },
    ],
  },
  {
    id: "seed-project-018", name: "Full Building Repointing & Masonry", buildingId: B.edgecombe,
    category: "FACADE", status: "IN_PROGRESS", priority: "HIGH", health: "OVER_BUDGET",
    estimatedBudget: 220000, approvedBudget: 240000, actualCost: 268000, percentComplete: 75,
    startDate: daysAgo(365), targetEndDate: daysFromNow(45), ownerVisible: true,
    milestones: [
      { id: "seed-ms-018a", name: "Scaffold erection", status: "COMPLETED", completedAt: daysAgo(340) },
      { id: "seed-ms-018b", name: "North & East facade", status: "COMPLETED", completedAt: daysAgo(250) },
      { id: "seed-ms-018c", name: "South facade", status: "COMPLETED", completedAt: daysAgo(150) },
      { id: "seed-ms-018d", name: "West facade", status: "IN_PROGRESS", dueDate: daysFromNow(20) },
      { id: "seed-ms-018e", name: "Scaffold removal & final inspection", status: "PENDING", dueDate: daysFromNow(40) },
    ],
    changeOrders: [
      { id: "seed-co-018a", title: "Additional lintel repairs", amount: 15000, status: "APPROVED", approvedAt: daysAgo(200) },
      { id: "seed-co-018b", title: "Parapet wall rebuild", amount: 18000, status: "APPROVED", approvedAt: daysAgo(120) },
      { id: "seed-co-018c", title: "Weather delay extension", amount: 7000, status: "SUBMITTED" },
    ],
    activities: [
      { id: "seed-act-018a", action: "CHANGE_ORDER_CREATED", detail: '"Additional lintel repairs" — $15,000', createdAt: daysAgo(200) },
      { id: "seed-act-018b", action: "CHANGE_ORDER_CREATED", detail: '"Parapet wall rebuild" — $18,000', createdAt: daysAgo(120) },
      { id: "seed-act-018c", action: "CHANGE_ORDER_CREATED", detail: '"Weather delay extension" — $7,000', createdAt: daysAgo(5) },
    ],
  },
  {
    id: "seed-project-019", name: "Solar Panel Installation Feasibility", buildingId: B.overlook,
    category: "LOCAL_LAW", status: "ESTIMATING", priority: "LOW", health: "ON_TRACK",
    estimatedBudget: 350000, approvedBudget: null, actualCost: 0,
    targetEndDate: daysFromNow(365), ownerVisible: true, requiresApproval: true,
    activities: [
      { id: "seed-act-019a", action: "PROJECT_CREATED", detail: "Feasibility study initiated", createdAt: daysAgo(14) },
    ],
  },
  {
    id: "seed-project-020", name: "Make-Ready — Unit 2C Full Renovation", buildingId: B.aqueduct,
    category: "TURNOVER", status: "IN_PROGRESS", priority: "HIGH", health: "ON_TRACK",
    estimatedBudget: 18500, approvedBudget: 19000, actualCost: 9800, percentComplete: 50,
    startDate: daysAgo(20), targetEndDate: daysFromNow(25), ownerVisible: false,
    milestones: [
      { id: "seed-ms-020a", name: "Unit inspection & scope", status: "COMPLETED", completedAt: daysAgo(18) },
      { id: "seed-ms-020b", name: "Paint & flooring", status: "COMPLETED", completedAt: daysAgo(10) },
      { id: "seed-ms-020c", name: "Kitchen & bath", status: "IN_PROGRESS", dueDate: daysFromNow(10) },
      { id: "seed-ms-020d", name: "Cleaning & final walkthrough", status: "PENDING", dueDate: daysFromNow(22) },
    ],
    activities: [
      { id: "seed-act-020a", action: "PROJECT_CREATED", detail: "Turnover project for Unit 2C", createdAt: daysAgo(20) },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) { console.error("No ADMIN user found"); process.exit(1); }

  const orgId = admin.organizationId || "org_default";
  console.log(`Using admin: ${admin.name} (${admin.id}), orgId: ${orgId}\n`);

  let created = 0;
  let errors = 0;

  for (const p of projects) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.project.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            orgId,
            buildingId: p.buildingId,
            createdById: admin.id,
            managerId: admin.id,
            name: p.name,
            description: p.description || null,
            category: p.category as any,
            status: p.status as any,
            priority: p.priority as any,
            health: p.health as any,
            estimatedBudget: p.estimatedBudget ?? null,
            approvedBudget: p.approvedBudget ?? null,
            actualCost: p.actualCost ?? 0,
            percentComplete: p.percentComplete ?? 0,
            startDate: p.startDate ?? null,
            targetEndDate: p.targetEndDate ?? null,
            actualEndDate: p.actualEndDate ?? null,
            ownerVisible: p.ownerVisible ?? false,
            requiresApproval: p.requiresApproval ?? false,
            approvedAt: p.status === "APPROVED" || p.status === "IN_PROGRESS" || p.status === "COMPLETED" || p.status === "CLOSED" || p.status === "SUBSTANTIALLY_COMPLETE" ? daysAgo(Math.max(1, Math.floor(Math.random() * 30) + 5)) : null,
            approvedById: ["APPROVED", "IN_PROGRESS", "COMPLETED", "CLOSED", "SUBSTANTIALLY_COMPLETE"].includes(p.status) ? admin.id : null,
          },
          update: {
            name: p.name,
            description: p.description || null,
            category: p.category as any,
            status: p.status as any,
            priority: p.priority as any,
            health: p.health as any,
            estimatedBudget: p.estimatedBudget ?? null,
            approvedBudget: p.approvedBudget ?? null,
            actualCost: p.actualCost ?? 0,
            percentComplete: p.percentComplete ?? 0,
            startDate: p.startDate ?? null,
            targetEndDate: p.targetEndDate ?? null,
            actualEndDate: p.actualEndDate ?? null,
            ownerVisible: p.ownerVisible ?? false,
          },
        });

        // Milestones
        if (p.milestones) {
          for (const m of p.milestones) {
            await tx.projectMilestone.upsert({
              where: { id: m.id },
              create: { id: m.id, projectId: p.id, name: m.name, status: m.status as any, dueDate: m.dueDate ?? null, completedAt: m.completedAt ?? null },
              update: { name: m.name, status: m.status as any, dueDate: m.dueDate ?? null, completedAt: m.completedAt ?? null },
            });
          }
        }

        // Budget lines
        if (p.budgetLines) {
          for (const bl of p.budgetLines) {
            await tx.projectBudgetLine.upsert({
              where: { id: bl.id },
              create: { id: bl.id, projectId: p.id, category: bl.category, estimated: bl.estimated, actual: bl.actual ?? null },
              update: { category: bl.category, estimated: bl.estimated, actual: bl.actual ?? null },
            });
          }
        }

        // Change orders
        if (p.changeOrders) {
          for (const co of p.changeOrders) {
            await tx.projectChangeOrder.upsert({
              where: { id: co.id },
              create: { id: co.id, projectId: p.id, title: co.title, amount: co.amount, status: co.status as any, approvedAt: co.approvedAt ?? null },
              update: { title: co.title, amount: co.amount, status: co.status as any, approvedAt: co.approvedAt ?? null },
            });
          }
        }

        // Activities
        if (p.activities) {
          for (const a of p.activities) {
            await tx.projectActivity.upsert({
              where: { id: a.id },
              create: { id: a.id, projectId: p.id, userId: admin.id, action: a.action, detail: a.detail ?? null, createdAt: a.createdAt },
              update: { action: a.action, detail: a.detail ?? null },
            });
          }
        }
      });

      console.log(`  ✓ ${p.name} (${p.health})`);
      created++;
    } catch (err: any) {
      console.error(`  ✗ ${p.name}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nCreated ${created} projects successfully${errors ? `, ${errors} errors` : ""}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
