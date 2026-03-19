/**
 * AtlasPM Demo Seed — creates a realistic NYC portfolio
 * Run: npx tsx prisma/seed-demo.ts
 *
 * Story: Icer Management LLC runs 3 Bronx buildings.
 *   - 600 Edgecombe Ave: clean, well-managed
 *   - 2376 Hoffman St: violation-heavy, HPD issues
 *   - 1515 Grand Concourse: collections nightmare
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}
function daysFromNow(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() + n); return d;
}

async function main() {
  console.log("🏗️  Seeding demo portfolio...\n");

  // ── Org ──
  const org = await prisma.organization.upsert({
    where: { slug: "icer-demo" },
    update: {},
    create: { name: "Icer Management LLC", slug: "icer-demo" },
  });

  // ── Users ──
  const hash = await bcrypt.hash("demo1234", 12);

  const admin = await prisma.user.upsert({
    where: { username: "demo-admin" },
    update: {},
    create: {
      email: "admin@icermgmt.com",
      name: "Sarah Chen",
      username: "demo-admin",
      passwordHash: hash,
      role: "ADMIN",
      organizationId: org.id,
      onboardingComplete: true,
    },
  });

  const pm = await prisma.user.upsert({
    where: { username: "demo-pm" },
    update: {},
    create: {
      email: "pm@icermgmt.com",
      name: "Marcus Rivera",
      username: "demo-pm",
      passwordHash: hash,
      role: "PM",
      organizationId: org.id,
      onboardingComplete: true,
    },
  });

  const collector = await prisma.user.upsert({
    where: { username: "demo-collector" },
    update: {},
    create: {
      email: "collector@icermgmt.com",
      name: "Diana Rossi",
      username: "demo-collector",
      passwordHash: hash,
      role: "COLLECTOR",
      organizationId: org.id,
      onboardingComplete: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: { username: "demo-owner" },
    update: {},
    create: {
      email: "owner@icermgmt.com",
      name: "James Whitfield",
      username: "demo-owner",
      passwordHash: hash,
      role: "OWNER",
      organizationId: org.id,
      onboardingComplete: true,
    },
  });

  // ── Buildings ──
  const bClean = await prisma.building.upsert({
    where: { yardiId: "demo-600edge" },
    update: {},
    create: {
      yardiId: "demo-600edge",
      address: "600 Edgecombe Avenue",
      borough: "Manhattan",
      block: "02100", lot: "0045",
      entity: "600 Edge LLC",
      portfolio: "Uptown",
      region: "Manhattan North",
      type: "Residential",
      totalUnits: 6, floors: 5, yearBuilt: 1928,
      buildingStatus: "active", rentStabilized: true,
      organizationId: org.id,
    },
  });

  const bViolation = await prisma.building.upsert({
    where: { yardiId: "demo-2376hoff" },
    update: {},
    create: {
      yardiId: "demo-2376hoff",
      address: "2376 Hoffman Street",
      borough: "Bronx",
      block: "03200", lot: "0012",
      entity: "Hoffman Holdings LLC",
      portfolio: "Bronx East",
      region: "Bronx",
      type: "Residential",
      totalUnits: 8, floors: 6, yearBuilt: 1952,
      buildingStatus: "active", rentStabilized: true,
      organizationId: org.id,
    },
  });

  const bCollections = await prisma.building.upsert({
    where: { yardiId: "demo-1515gc" },
    update: {},
    create: {
      yardiId: "demo-1515gc",
      address: "1515 Grand Concourse",
      borough: "Bronx",
      block: "02500", lot: "0080",
      entity: "Grand Concourse Partners LP",
      portfolio: "Bronx West",
      region: "Bronx",
      type: "Residential",
      totalUnits: 6, floors: 5, yearBuilt: 1940,
      buildingStatus: "active", rentStabilized: true,
      organizationId: org.id,
    },
  });

  const buildings = [bClean, bViolation, bCollections];

  // Assign all users to all buildings
  for (const u of [admin, pm, collector, owner]) {
    for (const b of buildings) {
      await prisma.userProperty.upsert({
        where: { userId_buildingId: { userId: u.id, buildingId: b.id } },
        update: {},
        create: { userId: u.id, buildingId: b.id },
      });
    }
  }

  // ── Helper: create unit + tenant ──
  async function seedUnit(
    buildingId: string,
    unitNumber: string,
    opts: {
      bedrooms?: number; sqFt?: number; legalRent: number; actualRent: number;
      firstName: string; lastName: string; email?: string; phone?: string;
      balance?: number; arrearsCategory?: string; arrearsDays?: number;
      monthsOwed?: number; collectionScore?: number; leaseStatus?: string;
      moveInDate?: Date; leaseExpiration?: Date; isVacant?: boolean;
    }
  ) {
    const unit = await prisma.unit.upsert({
      where: { buildingId_unitNumber: { buildingId, unitNumber } },
      update: {},
      create: {
        buildingId, unitNumber,
        bedroomCount: opts.bedrooms ?? 2,
        bathroomCount: 1,
        squareFeet: opts.sqFt ?? 750,
        legalRent: opts.legalRent,
        askingRent: opts.actualRent,
        isVacant: opts.isVacant ?? false,
        rentStabilized: true,
        regulationType: "STABILIZED",
        isResidential: true,
      },
    });

    if (opts.isVacant) return { unit, tenant: null };

    const tenant = await prisma.tenant.upsert({
      where: { unitId: unit.id },
      update: {
        balance: opts.balance ?? 0,
        arrearsCategory: opts.arrearsCategory ?? "current",
        arrearsDays: opts.arrearsDays ?? 0,
        monthsOwed: opts.monthsOwed ?? 0,
        collectionScore: opts.collectionScore ?? 0,
      },
      create: {
        unitId: unit.id,
        name: `${opts.firstName} ${opts.lastName}`,
        firstName: opts.firstName,
        lastName: opts.lastName,
        email: opts.email,
        phone: opts.phone,
        legalRent: opts.legalRent,
        actualRent: opts.actualRent,
        marketRent: opts.actualRent,
        deposit: opts.actualRent,
        balance: opts.balance ?? 0,
        arrearsCategory: opts.arrearsCategory ?? "current",
        arrearsDays: opts.arrearsDays ?? 0,
        monthsOwed: opts.monthsOwed ?? 0,
        collectionScore: opts.collectionScore ?? 0,
        leaseStatus: opts.leaseStatus ?? "active",
        isStabilized: true,
        moveInDate: opts.moveInDate ?? daysAgo(730),
        leaseExpiration: opts.leaseExpiration ?? daysFromNow(180),
      },
    });

    return { unit, tenant };
  }

  // ═══ BUILDING 1: 600 Edgecombe — The Clean Building ═══
  console.log("  ✓ 600 Edgecombe Avenue — clean building");
  const e1 = await seedUnit(bClean.id, "1A", { legalRent: 1450, actualRent: 1450, firstName: "Angela", lastName: "Torres", email: "atorres@email.com", phone: "212-555-1001" });
  const e2 = await seedUnit(bClean.id, "2A", { legalRent: 1620, actualRent: 1550, firstName: "David", lastName: "Okafor", email: "dokafor@email.com", phone: "212-555-1002" });
  const e3 = await seedUnit(bClean.id, "2B", { legalRent: 1380, actualRent: 1380, firstName: "Maria", lastName: "Santos", phone: "212-555-1003" });
  const e4 = await seedUnit(bClean.id, "3A", { legalRent: 1750, actualRent: 1700, firstName: "Robert", lastName: "Kim", email: "rkim@email.com" });
  const e5 = await seedUnit(bClean.id, "4A", { legalRent: 1550, actualRent: 1550, firstName: "Patricia", lastName: "Nguyen", phone: "212-555-1005", balance: 1550, arrearsCategory: "30", arrearsDays: 22, monthsOwed: 1, collectionScore: 15 });
  const e6 = await seedUnit(bClean.id, "5A", { legalRent: 1900, actualRent: 1850, firstName: "William", lastName: "Johnson", email: "wjohnson@email.com" });

  // ═══ BUILDING 2: 2376 Hoffman — Violation-Heavy ═══
  console.log("  ✓ 2376 Hoffman Street — violation-heavy building");
  const h1 = await seedUnit(bViolation.id, "1A", { legalRent: 1200, actualRent: 1200, firstName: "Carlos", lastName: "Mendez", phone: "718-555-2001" });
  const h2 = await seedUnit(bViolation.id, "1B", { legalRent: 1350, actualRent: 1280, firstName: "Lisa", lastName: "Washington", email: "lwash@email.com", balance: 2560, arrearsCategory: "60", arrearsDays: 48, monthsOwed: 2, collectionScore: 35 });
  const h3 = await seedUnit(bViolation.id, "2A", { legalRent: 1400, actualRent: 1400, firstName: "Ahmed", lastName: "Hassan", phone: "718-555-2003" });
  const h4 = await seedUnit(bViolation.id, "2B", { legalRent: 1250, actualRent: 1250, firstName: "Jennifer", lastName: "O'Brien", email: "jobrien@email.com" });
  const h5 = await seedUnit(bViolation.id, "3A", { bedrooms: 3, sqFt: 950, legalRent: 1600, actualRent: 1500, firstName: "Kenji", lastName: "Tanaka", phone: "718-555-2005", balance: 1500, arrearsCategory: "30", arrearsDays: 18, monthsOwed: 1, collectionScore: 12 });
  const h6 = await seedUnit(bViolation.id, "3B", { legalRent: 1300, actualRent: 1300, firstName: "Fatima", lastName: "Ali", email: "fali@email.com" });
  const h7 = await seedUnit(bViolation.id, "4A", { legalRent: 1450, actualRent: 1450, firstName: "Daniel", lastName: "Petrov" });
  const h8v = await seedUnit(bViolation.id, "4B", { legalRent: 1350, actualRent: 1350, firstName: "Vacant", lastName: "Unit", isVacant: true });

  // ═══ BUILDING 3: 1515 Grand Concourse — Collections Problems ═══
  console.log("  ✓ 1515 Grand Concourse — collections-problem building");
  const g1 = await seedUnit(bCollections.id, "1A", { legalRent: 1500, actualRent: 1500, firstName: "Tyrone", lastName: "Jackson", phone: "718-555-3001", balance: 12500, arrearsCategory: "120+", arrearsDays: 145, monthsOwed: 8.3, collectionScore: 92, leaseStatus: "expired", leaseExpiration: daysAgo(60) });
  const g2 = await seedUnit(bCollections.id, "1B", { legalRent: 1400, actualRent: 1400, firstName: "Svetlana", lastName: "Volkov", email: "svolkov@email.com", balance: 7200, arrearsCategory: "90", arrearsDays: 98, monthsOwed: 5.1, collectionScore: 78 });
  const g3 = await seedUnit(bCollections.id, "2A", { legalRent: 1550, actualRent: 1550, firstName: "Rosa", lastName: "Gutierrez", phone: "718-555-3003", balance: 3100, arrearsCategory: "60", arrearsDays: 52, monthsOwed: 2, collectionScore: 40 });
  const g4 = await seedUnit(bCollections.id, "2B", { legalRent: 1350, actualRent: 1350, firstName: "Kwame", lastName: "Asante", email: "kasante@email.com" });
  const g5 = await seedUnit(bCollections.id, "3A", { legalRent: 1600, actualRent: 1600, firstName: "Mikhail", lastName: "Petrov", phone: "718-555-3005", balance: 4800, arrearsCategory: "90", arrearsDays: 85, monthsOwed: 3, collectionScore: 65 });
  const g6 = await seedUnit(bCollections.id, "3B", { legalRent: 1250, actualRent: 1250, firstName: "Grace", lastName: "Obi", email: "gobi@email.com", balance: 1250, arrearsCategory: "30", arrearsDays: 28, monthsOwed: 1, collectionScore: 18 });

  // ── Violations on Hoffman St ──
  console.log("  ✓ HPD violations on 2376 Hoffman");
  const violationData = [
    { unit: h1.unit, cls: "C" as const, sev: "IMMEDIATELY_HAZARDOUS" as const, desc: "Defective smoke detector in apartment. Not operational.", respondDays: 7, penalty: 500 },
    { unit: h1.unit, cls: "B" as const, sev: "HAZARDOUS" as const, desc: "Peeling lead paint in living room, child under 6 present.", respondDays: 30, penalty: 1000 },
    { unit: h2.unit, cls: "C" as const, sev: "IMMEDIATELY_HAZARDOUS" as const, desc: "No hot water supply to apartment. Boiler malfunction.", respondDays: 3, penalty: 1000 },
    { unit: h3.unit, cls: "B" as const, sev: "HAZARDOUS" as const, desc: "Broken window lock in bedroom. Security risk.", respondDays: 30, penalty: 250 },
    { unit: h5.unit, cls: "C" as const, sev: "IMMEDIATELY_HAZARDOUS" as const, desc: "Roach infestation in kitchen. Evidence of droppings.", respondDays: 14, penalty: 500 },
    { unit: null, cls: "B" as const, sev: "HAZARDOUS" as const, desc: "Missing handrail on 3rd floor staircase.", respondDays: 30, penalty: 250 },
    { unit: h6.unit, cls: "B" as const, sev: "HAZARDOUS" as const, desc: "Cracked bathroom tiles with exposed substrate. Trip hazard.", respondDays: 30, penalty: 250 },
  ];

  const violations = [];
  for (let i = 0; i < violationData.length; i++) {
    const v = violationData[i];
    const viol = await prisma.violation.upsert({
      where: { source_externalId: { source: "HPD", externalId: `HPD-DEMO-${i + 1}` } },
      update: {},
      create: {
        buildingId: bViolation.id,
        unitId: v.unit?.id ?? undefined,
        unitNumber: v.unit?.unitNumber ?? undefined,
        source: "HPD",
        externalId: `HPD-DEMO-${i + 1}`,
        class: v.cls,
        severity: v.sev,
        description: v.desc,
        novDescription: v.desc,
        currentStatus: "OPEN",
        isOpen: true,
        lifecycleStatus: i < 3 ? "INGESTED" : "TRIAGED",
        issuedDate: daysAgo(15 + i * 5),
        respondByDate: daysFromNow(v.respondDays),
        penaltyAmount: v.penalty,
      },
    });
    violations.push(viol);
  }

  // ── Work Orders ──
  console.log("  ✓ Work orders");
  // WO linked to violation (hot water)
  await prisma.workOrder.create({
    data: {
      buildingId: bViolation.id,
      unitId: h2.unit.id,
      title: "Boiler repair — no hot water 2376 Hoffman #1B",
      description: "HPD Class C violation. Boiler malfunction causing no hot water to apartment 1B. Tenant complaint filed. Emergency priority.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      category: "HVAC",
      violationId: violations[2].id,
      assignedToId: pm.id,
      createdById: admin.id,
      dueDate: daysFromNow(2),
    },
  });
  // Routine plumbing
  await prisma.workOrder.create({
    data: {
      buildingId: bClean.id,
      unitId: e3.unit.id,
      title: "Leaking kitchen faucet — 600 Edgecombe #2B",
      description: "Tenant reports slow drip from kitchen faucet. Not urgent.",
      status: "OPEN",
      priority: "LOW",
      category: "PLUMBING",
      assignedToId: pm.id,
      createdById: admin.id,
    },
  });
  // Pest control
  await prisma.workOrder.create({
    data: {
      buildingId: bViolation.id,
      unitId: h5.unit.id,
      title: "Pest treatment — 2376 Hoffman #3A",
      description: "Roach infestation per HPD violation. Schedule exterminator.",
      status: "OPEN",
      priority: "HIGH",
      category: "OTHER",
      violationId: violations[4].id,
      createdById: admin.id,
      dueDate: daysFromNow(7),
    },
  });
  // Completed WO
  await prisma.workOrder.create({
    data: {
      buildingId: bCollections.id,
      title: "Hallway light replacement — 1515 Grand Concourse",
      description: "Replace burned-out hallway light fixtures on floors 2 and 3.",
      status: "COMPLETED",
      priority: "MEDIUM",
      category: "ELECTRICAL",
      assignedToId: pm.id,
      createdById: admin.id,
      completedDate: daysAgo(5),
      actualCost: 320,
    },
  });

  // ── Legal Cases ──
  console.log("  ✓ Legal cases");
  // Jackson — deep arrears, nonpayment filed
  if (g1.tenant) {
    await prisma.collectionCase.upsert({
      where: { id: `demo-cc-${g1.tenant.id}` },
      update: {},
      create: {
        id: `demo-cc-${g1.tenant.id}`,
        buildingId: bCollections.id,
        unitId: g1.unit.id,
        tenantId: g1.tenant.id,
        balanceOwed: 12500,
        daysLate: 145,
        status: "legal_referred",
        isActive: true,
        assignedUserId: collector.id,
      },
    });
    await prisma.legalCase.create({
      data: {
        tenantId: g1.tenant.id,
        buildingId: bCollections.id,
        unitId: g1.unit.id,
        inLegal: true,
        stage: "NONPAYMENT",
        caseNumber: "L&T 54321/26",
        attorney: "Law Offices of Cohen & Associates",
        filedDate: daysAgo(30),
        courtDate: daysFromNow(14),
        arrearsBalance: 12500,
        status: "active",
        isActive: true,
        assignedUserId: collector.id,
      },
    });
  }

  // Volkov — stipulation stage
  if (g2.tenant) {
    await prisma.collectionCase.upsert({
      where: { id: `demo-cc-${g2.tenant.id}` },
      update: {},
      create: {
        id: `demo-cc-${g2.tenant.id}`,
        buildingId: bCollections.id,
        unitId: g2.unit.id,
        tenantId: g2.tenant.id,
        balanceOwed: 7200,
        daysLate: 98,
        status: "legal_referred",
        isActive: true,
        assignedUserId: collector.id,
      },
    });
    await prisma.legalCase.create({
      data: {
        tenantId: g2.tenant.id,
        buildingId: bCollections.id,
        unitId: g2.unit.id,
        inLegal: true,
        stage: "STIPULATION",
        caseNumber: "L&T 67890/26",
        attorney: "Law Offices of Cohen & Associates",
        filedDate: daysAgo(75),
        courtDate: daysAgo(10),
        arrearsBalance: 7200,
        status: "active",
        isActive: true,
        notes_text: "Stipulation signed — tenant agreed to $600/month payment plan on top of rent.",
      },
    });
  }

  // ── Collection notes ──
  console.log("  ✓ Collection notes");
  if (g1.tenant) {
    await prisma.collectionNote.create({
      data: { tenantId: g1.tenant.id, buildingId: bCollections.id, authorId: collector.id, content: "Called tenant. No answer. Left voicemail regarding $12,500 balance.", actionType: "LEFT_VOICEMAIL", followUpDate: daysFromNow(3) },
    });
    await prisma.collectionNote.create({
      data: { tenantId: g1.tenant.id, buildingId: bCollections.id, authorId: collector.id, content: "Demand notice sent via certified mail. 14-day cure period.", actionType: "NOTICE_SENT", createdAt: daysAgo(45) },
    });
  }
  if (g3.tenant) {
    await prisma.collectionNote.create({
      data: { tenantId: g3.tenant.id, buildingId: bCollections.id, authorId: collector.id, content: "Spoke with tenant. Claims financial hardship. Will attempt partial payment by Friday.", actionType: "CALLED", followUpDate: daysFromNow(5) },
    });
  }

  // ── Payments ──
  console.log("  ✓ Payment history");
  // Clean building — regular payments
  for (const t of [e1, e2, e3, e4, e6]) {
    if (!t.tenant) continue;
    await prisma.payment.create({
      data: { tenantId: t.tenant.id, recordedBy: admin.id, amount: t.tenant.actualRent, date: daysAgo(5), method: "check", reference: `CHK-${Math.floor(Math.random() * 9000) + 1000}` },
    });
  }
  // Partial payment from Gutierrez
  if (g3.tenant) {
    await prisma.payment.create({
      data: { tenantId: g3.tenant.id, recordedBy: admin.id, amount: 500, date: daysAgo(10), method: "money_order", notes: "Partial payment — tenant promised remainder by end of month." },
    });
  }

  console.log("\n✅ Demo seed complete!");
  console.log("   3 buildings, 20 units, 19 tenants");
  console.log("   7 HPD violations, 4 work orders, 2 legal cases");
  console.log("\n   Login credentials (all passwords: demo1234):");
  console.log("   Admin:     demo-admin");
  console.log("   PM:        demo-pm");
  console.log("   Collector: demo-collector");
  console.log("   Owner:     demo-owner\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
