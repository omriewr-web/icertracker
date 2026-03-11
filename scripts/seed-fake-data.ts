/**
 * Full database reset + fake data seed for AtlasPM development/testing.
 * Run: npx tsx scripts/seed-fake-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ──────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start));
}

function futureDate(monthsMin: number, monthsMax: number): Date {
  const now = new Date();
  const months = randInt(monthsMin, monthsMax);
  return new Date(now.getFullYear(), now.getMonth() + months, randInt(1, 28));
}

function pastDate(monthsMin: number, monthsMax: number): Date {
  const now = new Date();
  const months = randInt(monthsMin, monthsMax);
  return new Date(now.getFullYear(), now.getMonth() - months, randInt(1, 28));
}

function padNum(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

// ── Name & Address Data ──────────────────────────────────────────

const FIRST_NAMES = [
  "Maria", "José", "James", "Wei", "Fatou", "Carlos", "Diana", "Ahmed", "Rosa", "David",
  "Luz", "Mohammed", "Carmen", "Kwame", "Yolanda", "Ivan", "Priya", "Samuel", "Aisha", "Robert",
  "Elena", "Tyrone", "Mei-Ling", "Francisco", "Tatiana", "Darnell", "Sonia", "Rashid", "Gloria", "Kevin",
  "Nadia", "Hector", "Olga", "Jamal", "Luisa", "Dmitri", "Esperanza", "Andre", "Yuki", "Marcus",
  "Valentina", "Desmond", "Amina", "Jorge", "Lakisha", "Pierre", "Xiomara", "Terrence", "Binta", "Rafael",
  "Keisha", "Vladimir", "Adeola", "Roberto", "Jasmine", "Hassan", "Marisol", "Dwayne", "Fatima", "Lorenzo",
];

const LAST_NAMES = [
  "Rodriguez", "Chen", "Williams", "Diallo", "Martinez", "Kim", "Johnson", "Okafor", "Hernandez", "Singh",
  "Brown", "Perez", "Wang", "Davis", "Gonzalez", "Petrov", "Thompson", "Morales", "Lee", "Jackson",
  "Torres", "Nguyen", "Harris", "Rivera", "Clark", "Abrams", "Patel", "Robinson", "Lopez", "Walker",
  "Garcia", "Lewis", "Hall", "Young", "Allen", "Sanchez", "Wright", "King", "Scott", "Green",
  "Baker", "Adams", "Nelson", "Hill", "Ramirez", "Campbell", "Mitchell", "Roberts", "Carter", "Phillips",
];

const BRONX_STREETS = [
  "Grand Concourse", "Tremont Avenue", "Fordham Road", "Jerome Avenue", "Burnside Avenue",
  "University Avenue", "Morris Avenue", "Walton Avenue", "Creston Avenue", "Davidson Avenue",
  "Ogden Avenue", "Nelson Avenue", "Sedgwick Avenue", "Webb Avenue", "Bailey Avenue",
  "Mosholu Parkway", "Kingsbridge Road", "Reservoir Avenue", "Aqueduct Avenue", "Andrews Avenue",
];

const HARLEM_STREETS = [
  "Adam Clayton Powell Jr Blvd", "Frederick Douglass Blvd", "Lenox Avenue", "St Nicholas Avenue",
  "Edgecombe Avenue", "Convent Avenue", "Amsterdam Avenue", "Manhattan Avenue",
  "West 125th Street", "West 135th Street", "West 140th Street", "West 145th Street",
  "West 148th Street", "West 150th Street", "West 152nd Street", "West 155th Street",
];

const UPPER_MANHATTAN_STREETS = [
  "Fort Washington Avenue", "Cabrini Boulevard", "Pinehurst Avenue", "Haven Avenue",
  "Overlook Terrace", "Bennett Avenue", "Nagle Avenue", "Dyckman Street",
  "West 181st Street", "West 187th Street", "West 190th Street", "West 193rd Street",
];

const BROOKLYN_STREETS = [
  "Atlantic Avenue", "Nostrand Avenue", "Bedford Avenue", "Franklin Avenue",
  "Fulton Street", "DeKalb Avenue", "Myrtle Avenue", "Flatbush Avenue",
  "Sterling Place", "Park Place", "Prospect Place", "Bergen Street",
];

const HPD_VIOLATIONS = [
  "REPAIR THE BROKEN OR DEFECTIVE PLASTERED SURFACES AND PAINT IN A UNIFORM COLOR",
  "PROPERLY REPAIR THE SOURCE AND ABATE THE EVIDENCE OF A WATER LEAK AT THE CEILING",
  "INSTALL MISSING OR REPAIR/REPLACE THE DEFECTIVE WINDOW GUARD AT THE WINDOW",
  "PROVIDE ADEQUATE LIGHTING IN THE PUBLIC HALLWAY ON THE 1ST FLOOR",
  "REPAIR OR REPLACE THE BROKEN DOOR LOCK AT THE ENTRANCE DOOR",
  "ABATE THE NUISANCE CONSISTING OF VERMIN, ROACH CONDITION IN THE ENTIRE APARTMENT",
  "REPAIR OR REPLACE THE DEFECTIVE FAUCET AT THE KITCHEN SINK",
  "RESTORE HOT WATER TO THE FIXTURES IN THE BATHROOM",
  "REPAIR THE BROKEN OR DEFECTIVE FLOOR IN THE KITCHEN",
  "REPLACE THE DEFECTIVE OR MISSING SMOKE DETECTOR IN THE APARTMENT",
  "REPAIR OR REPLACE THE DEFECTIVE RADIATOR VALVE IN THE LIVING ROOM",
  "REPAIR THE BROKEN OR DEFECTIVE WINDOW AT THE BEDROOM",
  "REMOVE THE PEELING PAINT AND PLASTER FROM THE WALLS AND CEILING IN THE LIVING ROOM",
  "PROVIDE HEAT IN THE APARTMENT ADEQUATE TO MAINTAIN A TEMPERATURE OF 68 DEGREES",
  "REPAIR THE BROKEN OR DEFECTIVE INTERCOM/BELL/BUZZER AT THE ENTRANCE DOOR",
  "PROPERLY REPAIR THE DEFECTIVE SELF-CLOSING MECHANISM ON THE FIRE ESCAPE DOOR",
  "REPAIR THE BROKEN OR DEFECTIVE MAILBOX LOCK",
  "REPAIR THE BROKEN OR DEFECTIVE STOVE IN THE KITCHEN",
  "CAULK AND SEAL THE BATHTUB RIM AT THE JUNCTION WITH THE WALL SURFACE",
  "REMOVE ALL LEAD-BASED PAINT HAZARDS IN THE APARTMENT WHERE A CHILD UNDER 6 RESIDES",
  "INSTALL A PROPER VENTILATION SYSTEM IN THE BATHROOM",
  "REPAIR THE DEFECTIVE TOILET IN THE BATHROOM",
  "PROVIDE AND MAINTAIN A PROPER CARBON MONOXIDE DETECTING DEVICE",
  "REPAIR THE DEFECTIVE ELECTRICAL OUTLET IN THE BEDROOM",
];

const WO_TITLES = [
  "Leaking faucet in kitchen", "No heat in unit", "Broken window in bedroom",
  "Roach infestation — needs exterminator", "Toilet running continuously", "Ceiling water damage from upstairs",
  "Front door lock broken", "Buzzer/intercom not working", "Peeling paint in hallway",
  "Radiator valve leaking", "Hot water intermittent", "Smoke detector beeping — needs battery",
  "Bathroom tile cracked", "Kitchen cabinet door broken", "Elevator stuck on 3rd floor",
  "Light out in stairwell", "Fire escape window stuck", "Garbage compactor jammed",
  "Mouse spotted in basement", "Boiler pressure low", "Window guard missing — child in unit",
  "Outlet sparking in living room", "Floor tiles coming loose", "Mold in bathroom ceiling",
  "Gas smell reported by tenant", "Mailbox lock broken", "Lobby door not closing properly",
  "Sprinkler head leaking", "Drain clogged in kitchen", "AC unit not cooling",
];

const ATTORNEYS = [
  "Smith & Associates", "NYC Legal Group", "Bronx Housing Advocates",
  "Manhattan Landlord Services", "Brooklyn Legal Partners",
];

const NOTE_TEMPLATES_COLLECTION = [
  "Called tenant, no answer. Left voicemail.",
  "Tenant called back, states they lost their job. Promised payment by end of month.",
  "Sent 5-day notice via certified mail.",
  "No response to multiple calls. Referred to attorney.",
  "Tenant disputes charge. Reviewing ledger.",
  "Attorney contacted, proceeding with petition.",
  "Tenant claims to have mailed check, not received. Asking for money order.",
  "Spoke with tenant's family member, they are aware of balance.",
  "Second notice sent. No response.",
  "Tenant requesting payment arrangement.",
  "Left notice on door. No one home during visit.",
  "Tenant states they will pay next Friday.",
  "Sent final warning letter before legal action.",
  "Contacted guarantor regarding outstanding balance.",
];

const NOTE_TEMPLATES_PAYMENT = [
  "Partial payment received via money order.",
  "Tenant came to office, paid partial. Remaining balance outstanding.",
  "Payment plan agreed: monthly installments starting next month.",
  "Check received, deposited. Balance updated.",
  "Online payment received.",
];

const NOTE_TEMPLATES_GENERAL = [
  "Inspection scheduled per tenant request regarding heat complaint.",
  "Tenant requesting lease renewal information.",
  "Maintenance request submitted for kitchen sink leak.",
  "Tenant reported noise complaint from upstairs neighbor.",
  "Annual apartment inspection completed. No issues found.",
];

const PAYMENT_METHODS = ["check", "money_order", "online", "cash", "ach"];

// ── Portfolio / Building Definitions ─────────────────────────────

interface BuildingDef {
  address: string;
  borough: string;
  portfolio: string;
  unitCount: number;
  type: string;
  yearBuilt: number;
  block: string;
  lot: string;
  zip: string;
  entity: string;
  aep: boolean;
}

function generateBuildings(): BuildingDef[] {
  const buildings: BuildingDef[] = [];
  let extId = 1;

  function addBuildings(
    count: number, portfolio: string, borough: string, streets: string[],
    zip: string, typeWeights: { elevator: number; walkup: number }, aepCount: number
  ) {
    const aepIndices = new Set<number>();
    while (aepIndices.size < aepCount) aepIndices.add(randInt(0, count - 1));

    for (let i = 0; i < count; i++) {
      const streetNum = randInt(100, 2500);
      const street = pick(streets);
      const addr = `${streetNum} ${street}`;
      const unitCount = typeWeights.elevator > 0.5 ? randInt(20, 65) : randInt(6, 30);
      const isElevator = Math.random() < typeWeights.elevator;
      const entityParts = street.split(" ").slice(0, 2).join(" ");
      buildings.push({
        address: addr,
        borough,
        portfolio,
        unitCount,
        type: isElevator ? "elevator" : "walkup",
        yearBuilt: randInt(1920, 1975),
        block: padNum(randInt(2000, 5999), 5),
        lot: padNum(randInt(1, 99), 4),
        zip,
        entity: `${streetNum} ${entityParts} LLC`,
        aep: aepIndices.has(i),
      });
      extId++;
    }
  }

  addBuildings(15, "Bronx Residential", "Bronx", BRONX_STREETS, "10453", { elevator: 0.15, walkup: 0.85 }, 3);
  addBuildings(12, "Harlem Heights", "Manhattan", HARLEM_STREETS, "10030", { elevator: 0.4, walkup: 0.6 }, 2);
  addBuildings(10, "Upper Manhattan", "Manhattan", UPPER_MANHATTAN_STREETS, "10033", { elevator: 0.7, walkup: 0.3 }, 2);
  addBuildings(8, "Brooklyn Mixed", "Brooklyn", BROOKLYN_STREETS, "11216", { elevator: 0.35, walkup: 0.65 }, 2);

  return buildings;
}

// ── Unit Generation ──────────────────────────────────────────────

interface UnitDef {
  unitNumber: string;
  unitType: string | null;
  unitCategory: string;
  isResidential: boolean;
  bedroomType: string;
}

function generateUnits(buildingDef: BuildingDef): UnitDef[] {
  const units: UnitDef[] = [];
  const isElevator = buildingDef.type === "elevator";
  const floors = isElevator ? Math.ceil(buildingDef.unitCount / 6) : Math.ceil(buildingDef.unitCount / 4);
  const unitsPerFloor = isElevator ? randInt(4, 6) : randInt(2, 4);
  const letters = ["A", "B", "C", "D", "E", "F"];
  const bedroomTypes = ["Studio", "1BR", "1BR", "2BR", "2BR", "2BR", "3BR"];

  let resCount = 0;
  for (let f = 1; f <= floors && resCount < buildingDef.unitCount; f++) {
    for (let u = 0; u < unitsPerFloor && resCount < buildingDef.unitCount; u++) {
      units.push({
        unitNumber: `${f}${letters[u]}`,
        unitType: pick(["rs", "rs-stu", "fm", "rssec8", "rsscrie"]),
        unitCategory: "residential",
        isResidential: true,
        bedroomType: pick(bedroomTypes),
      });
      resCount++;
    }
  }

  // Non-residential
  units.push({ unitNumber: "SUPER", unitType: "super", unitCategory: "super", isResidential: false, bedroomType: "" });
  units.push({ unitNumber: "LAUNDRY", unitType: "laundry", unitCategory: "laundry", isResidential: false, bedroomType: "" });
  if (isElevator) {
    units.push({ unitNumber: "PKG-1", unitType: "6d", unitCategory: "parking", isResidential: false, bedroomType: "" });
    if (Math.random() > 0.5) {
      units.push({ unitNumber: "PKG-2", unitType: "6d", unitCategory: "parking", isResidential: false, bedroomType: "" });
    }
  }

  return units;
}

// ── Rent Calculation ─────────────────────────────────────────────

function rentForType(bedroom: string): number {
  switch (bedroom) {
    case "Studio": return randInt(800, 1400);
    case "1BR": return randInt(1200, 2000);
    case "2BR": return randInt(1600, 2800);
    case "3BR": return randInt(2200, 3500);
    default: return randInt(1000, 2000);
  }
}

// ── Main Seed ────────────────────────────────────────────────────

async function main() {
  console.log("=== AtlasPM Full Database Reset & Seed ===\n");

  // ── STEP 1: WIPE ──
  console.log("Step 1: Wiping all data...");
  await prisma.utilityMonthlyCheck.deleteMany({});
  await prisma.utilityAccount.deleteMany({});
  await prisma.utilityMeter.deleteMany({});
  await prisma.legalNote.deleteMany({});
  await prisma.legalCase.deleteMany({});
  await prisma.workOrderComment.deleteMany({});
  await prisma.workOrder.deleteMany({});
  await prisma.violation.deleteMany({});
  await prisma.vacancyInfo.deleteMany({});
  await prisma.collectionNote.deleteMany({});
  await prisma.collectionCase.deleteMany({});
  await prisma.moveOutCharge.deleteMany({});
  await prisma.moveOutAssessment.deleteMany({});
  await prisma.inspectionItem.deleteMany({});
  await prisma.inspection.deleteMany({});
  await prisma.vacancy.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.activityEvent.deleteMany({});
  await prisma.aRSnapshot.deleteMany({});
  await prisma.balanceSnapshot.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.commLog.deleteMany({});
  await prisma.tenantNote.deleteMany({});
  await prisma.leaseOccupant.deleteMany({});
  await prisma.recurringCharge.deleteMany({});
  await prisma.lease.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.complianceItem.deleteMany({});
  await prisma.violationSyncLog.deleteMany({});
  await prisma.maintenanceSchedule.deleteMany({});
  await prisma.importRow.deleteMany({});
  await prisma.importFeedback.deleteMany({});
  await prisma.importStagingBatch.deleteMany({});
  await prisma.importRun.deleteMany({});
  await prisma.importBatch.deleteMany({});
  await prisma.importProfile.deleteMany({});
  await prisma.legalImportQueue.deleteMany({});
  await prisma.dhcrRent.deleteMany({});
  await prisma.emailLog.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.building.deleteMany({});
  await prisma.owner.deleteMany({});
  console.log("  Wiped clean.\n");

  // ── STEP 2: SEED ──
  console.log("Step 2: Seeding fake data...\n");

  // Find admin user for authoring notes/payments
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!adminUser) {
    console.error("ERROR: No admin user found. Please create a user first.");
    return;
  }
  const authorId = adminUser.id;
  console.log(`  Using admin user: ${adminUser.name} (${adminUser.email})\n`);

  const buildingDefs = generateBuildings();
  const stats = {
    buildings: 0,
    units: { residential: 0, nonResidential: 0 },
    tenants: 0,
    occupied: 0,
    vacant: 0,
    inArrears: 0,
    arrearsTotal: 0,
    legalCases: 0,
    legalByStage: {} as Record<string, number>,
    violations: { A: 0, B: 0, C: 0 },
    workOrders: { OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, ON_HOLD: 0 },
    meters: 0,
    notes: 0,
    payments: 0,
    portfolioCounts: {} as Record<string, number>,
  };

  for (const bDef of buildingDefs) {
    // Create building
    const shortCode = bDef.address.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20).toLowerCase();
    const building = await prisma.building.create({
      data: {
        yardiId: `SEED-${shortCode}-${Date.now()}${randInt(0, 9999)}`,
        propertyId: `${bDef.address.split(" ")[0]}-${bDef.address.split(" ").slice(1, 3).join("-").toLowerCase().substring(0, 15)}`,
        address: bDef.address,
        borough: bDef.borough,
        portfolio: bDef.portfolio,
        region: bDef.borough,
        zip: bDef.zip,
        block: bDef.block,
        lot: bDef.lot,
        entity: bDef.entity,
        type: "Residential",
        yearBuilt: bDef.yearBuilt,
        floors: bDef.type === "elevator" ? Math.ceil(bDef.unitCount / 5) : Math.ceil(bDef.unitCount / 3),
        constructionType: bDef.type === "elevator" ? "Elevator" : "Walk-up",
        elevator: bDef.type === "elevator",
        elevatorCount: bDef.type === "elevator" ? randInt(1, 2) : 0,
        aepStatus: bDef.aep ? "active" : "none",
        buildingStatus: "active",
        totalUnits: bDef.unitCount,
      },
    });

    stats.buildings++;
    stats.portfolioCounts[bDef.portfolio] = (stats.portfolioCounts[bDef.portfolio] || 0) + 1;

    const unitDefs = generateUnits(bDef);
    const residentialUnits: { id: string; unitNumber: string; bedroomType: string; isVacant: boolean }[] = [];

    // Create units
    for (const uDef of unitDefs) {
      const isVacant = uDef.isResidential ? Math.random() > 0.82 : true; // ~18% vacancy for res
      const unit = await prisma.unit.create({
        data: {
          buildingId: building.id,
          unitNumber: uDef.unitNumber,
          unitType: uDef.unitType,
          unitCategory: uDef.unitCategory,
          isResidential: uDef.isResidential,
          isVacant,
        },
      });

      if (uDef.isResidential) {
        stats.units.residential++;
        residentialUnits.push({ id: unit.id, unitNumber: uDef.unitNumber, bedroomType: uDef.bedroomType, isVacant });
        if (isVacant) stats.vacant++;
        else stats.occupied++;
      } else {
        stats.units.nonResidential++;
      }
    }

    // Create tenants for occupied residential units
    const occupiedUnits = residentialUnits.filter((u) => !u.isVacant);

    for (const unit of occupiedUnits) {
      const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      const rent = rentForType(unit.bedroomType);
      const moveIn = randDate(2015, 2024);

      // Balance distribution
      const balanceRoll = Math.random();
      let balance = 0;
      let arrearsCategory = "current";
      let arrearsDays = 0;
      let legalFlag = false;
      let collectionScore = 0;

      if (balanceRoll < 0.55) {
        // Current
        balance = randInt(-200, 0);
        arrearsCategory = "current";
        arrearsDays = 0;
        collectionScore = 0;
      } else if (balanceRoll < 0.75) {
        // Mild arrears
        balance = randInt(200, 1500);
        arrearsCategory = "30";
        arrearsDays = randInt(15, 55);
        collectionScore = randInt(10, 35);
      } else if (balanceRoll < 0.90) {
        // Moderate arrears
        balance = randInt(1500, 5000);
        arrearsCategory = "60";
        arrearsDays = randInt(45, 95);
        collectionScore = randInt(35, 65);
      } else if (balanceRoll < 0.97) {
        // Serious arrears
        balance = randInt(5000, 15000);
        arrearsCategory = "90";
        arrearsDays = randInt(90, 200);
        collectionScore = randInt(65, 85);
      } else {
        // Severe arrears + legal
        balance = randInt(15000, 40000);
        arrearsCategory = "120+";
        arrearsDays = randInt(150, 400);
        legalFlag = true;
        collectionScore = randInt(85, 100);
      }

      // Lease expiration
      const leaseRoll = Math.random();
      let leaseExpiration: Date;
      let leaseStatus: string;
      if (leaseRoll < 0.20) {
        // Expired
        leaseExpiration = pastDate(1, 18);
        leaseStatus = "expired";
      } else if (leaseRoll < 0.70) {
        // Expiring within 12 months
        leaseExpiration = futureDate(1, 12);
        leaseStatus = leaseExpiration.getTime() - Date.now() < 90 * 86400000 ? "expiring-soon" : "active";
      } else {
        // Long term
        leaseExpiration = futureDate(13, 36);
        leaseStatus = "active";
      }

      const isStabilized = Math.random() < 0.65;

      const tenant = await prisma.tenant.create({
        data: {
          unitId: unit.id,
          name,
          email: `${name.toLowerCase().replace(/ /g, ".")}@email.com`,
          phone: `(${randInt(212, 929)}) ${randInt(200, 999)}-${padNum(randInt(0, 9999), 4)}`,
          marketRent: rent,
          actualRent: rent,
          legalRent: isStabilized ? Math.round(rent * 0.85) : 0,
          isStabilized,
          moveInDate: moveIn,
          leaseExpiration,
          balance,
          arrearsCategory,
          arrearsDays,
          leaseStatus,
          collectionScore,
        },
      });

      stats.tenants++;
      if (balance > 0) {
        stats.inArrears++;
        stats.arrearsTotal += balance;
      }

      // Legal case
      if (legalFlag) {
        const stages = ["NOTICE_SENT", "HOLDOVER", "NONPAYMENT", "COURT_DATE", "STIPULATION", "WARRANT"] as const;
        const stage = pick([...stages]);
        await prisma.legalCase.create({
          data: {
            tenantId: tenant.id,
            buildingId: building.id,
            unitId: unit.id,
            inLegal: true,
            stage,
            caseNumber: `L&T ${randInt(10000, 99999)}/${randInt(2023, 2025)}`,
            attorney: pick(ATTORNEYS),
            filedDate: pastDate(1, 24),
            courtDate: Math.random() > 0.4 ? futureDate(1, 6) : null,
            arrearsBalance: Math.round(balance * 1.1),
            status: "active",
          },
        });
        stats.legalCases++;
        stats.legalByStage[stage] = (stats.legalByStage[stage] || 0) + 1;
      }

      // ── Tenant Notes (for tenants with balance > 0) ──
      if (balance > 0) {
        const noteCount = randInt(1, 4);
        for (let n = 0; n < noteCount; n++) {
          const roll = Math.random();
          let text: string;
          let category: "COLLECTION" | "PAYMENT" | "GENERAL" | "LEGAL";
          if (roll < 0.55) {
            text = pick(NOTE_TEMPLATES_COLLECTION);
            category = legalFlag ? "LEGAL" : "COLLECTION";
          } else if (roll < 0.80) {
            text = pick(NOTE_TEMPLATES_PAYMENT);
            category = "PAYMENT";
          } else {
            text = pick(NOTE_TEMPLATES_GENERAL);
            category = "GENERAL";
          }
          // Replace template placeholders
          text = text.replace("$X", `$${(balance - randInt(200, 800)).toLocaleString()}`);

          await prisma.tenantNote.create({
            data: {
              tenantId: tenant.id,
              authorId,
              text,
              category,
              createdAt: pastDate(0, 6),
            },
          });
          stats.notes++;
        }
      }

      // ── Payment History (for tenants in arrears — show they used to pay) ──
      if (balance > 0) {
        const paymentCount = randInt(2, 6);
        const rentAmount = rent;
        for (let p = 0; p < paymentCount; p++) {
          // Payments spread 2-18 months ago (before arrears started)
          const payDate = pastDate(2 + p * 2, 3 + p * 3);
          const payAmount = rentAmount + randInt(-100, 100); // slight variation
          await prisma.payment.create({
            data: {
              tenantId: tenant.id,
              recordedBy: authorId,
              amount: Math.max(500, payAmount),
              date: payDate,
              method: pick(PAYMENT_METHODS),
              reference: `${randInt(1000, 9999)}`,
              notes: null,
            },
          });
          stats.payments++;
        }
      }
    }

    // ── Violations ──
    const violationCount = bDef.aep ? randInt(22, 35) : randInt(15, 25);
    for (let v = 0; v < violationCount; v++) {
      const classRoll = Math.random();
      const vClass = classRoll < 0.30 ? "A" : classRoll < 0.75 ? "B" : "C";
      const isOpen = Math.random() < 0.60;
      const issued = pastDate(1, 36);
      const respond = new Date(issued.getTime() + randInt(14, 90) * 86400000);
      const targetUnit = residentialUnits.length > 0 ? pick(residentialUnits) : null;

      await prisma.violation.create({
        data: {
          buildingId: building.id,
          unitId: targetUnit?.id || null,
          unitNumber: targetUnit?.unitNumber || null,
          source: "HPD",
          externalId: `HPD-${randInt(100000, 999999)}-${randInt(1000, 9999)}`,
          class: vClass as any,
          severity: vClass === "C" ? "IMMEDIATELY_HAZARDOUS" : vClass === "B" ? "HAZARDOUS" : "NON_HAZARDOUS",
          description: pick(HPD_VIOLATIONS),
          novDescription: pick(HPD_VIOLATIONS),
          issuedDate: issued,
          inspectionDate: issued,
          respondByDate: respond,
          currentStatus: isOpen ? "OPEN" : "CLOSE",
          isOpen,
          needsWorkOrder: isOpen && vClass !== "A",
        },
      });

      stats.violations[vClass as "A" | "B" | "C"]++;
    }

    // ── Work Orders ──
    const woCount = randInt(15, 25);
    const woCategories = ["PLUMBING", "ELECTRICAL", "HVAC", "GENERAL", "OTHER"] as const;
    const woPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
    for (let w = 0; w < woCount; w++) {
      const statusRoll = Math.random();
      const status = statusRoll < 0.40 ? "OPEN" : statusRoll < 0.70 ? "IN_PROGRESS" : "COMPLETED";
      const targetUnit = residentialUnits.length > 0 ? pick(residentialUnits) : null;

      await prisma.workOrder.create({
        data: {
          buildingId: building.id,
          unitId: targetUnit?.id || null,
          title: pick(WO_TITLES),
          description: `Reported by tenant. ${pick(WO_TITLES)}. Please address promptly.`,
          status: status as any,
          priority: pick([...woPriorities]) as any,
          category: pick([...woCategories]) as any,
          createdAt: pastDate(0, 6),
          completedDate: status === "COMPLETED" ? pastDate(0, 3) : null,
        },
      });

      stats.workOrders[status as keyof typeof stats.workOrders]++;
    }

    // ── Utility Meters ──
    const bShort = bDef.address.split(" ")[0];

    for (const unit of residentialUnits) {
      // Electric
      await prisma.utilityMeter.create({
        data: {
          buildingId: building.id,
          unitId: unit.id,
          utilityType: "electric",
          providerName: "Con Edison",
          meterNumber: `E-${bShort}-${unit.unitNumber}`,
          isActive: true,
          accounts: {
            create: {
              accountNumber: `${randInt(10000000000, 99999999999)}`,
              assignedPartyType: unit.isVacant ? "owner" : "tenant",
              assignedPartyName: unit.isVacant ? "Owner" : undefined,
              status: "active",
            },
          },
        },
      });
      // Gas
      await prisma.utilityMeter.create({
        data: {
          buildingId: building.id,
          unitId: unit.id,
          utilityType: "gas",
          providerName: "National Grid",
          meterNumber: `G-${bShort}-${unit.unitNumber}`,
          isActive: true,
          accounts: {
            create: {
              accountNumber: `${randInt(10000000000, 99999999999)}`,
              assignedPartyType: unit.isVacant ? "owner" : "tenant",
              assignedPartyName: unit.isVacant ? "Owner" : undefined,
              status: "active",
            },
          },
        },
      });
      stats.meters += 2;
    }

    // Common area electric
    await prisma.utilityMeter.create({
      data: {
        buildingId: building.id,
        unitId: null,
        utilityType: "common_electric",
        providerName: "Con Edison",
        meterNumber: `E-${bShort}-COMMON`,
        isActive: true,
        accounts: {
          create: {
            accountNumber: `${randInt(10000000000, 99999999999)}`,
            assignedPartyType: "owner",
            assignedPartyName: "Owner",
            status: "active",
          },
        },
      },
    });
    stats.meters++;

    process.stdout.write(`  Building ${stats.buildings}/${buildingDefs.length}: ${bDef.address} (${bDef.portfolio})\r`);
  }

  console.log("\n\n=== Seed Complete ===\n");
  console.log("Buildings by portfolio:");
  for (const [p, c] of Object.entries(stats.portfolioCounts)) {
    console.log(`  ${p}: ${c}`);
  }
  console.log(`\nTotal buildings: ${stats.buildings}`);
  console.log(`Total units: ${stats.units.residential + stats.units.nonResidential} (${stats.units.residential} residential, ${stats.units.nonResidential} non-residential)`);
  console.log(`Total tenants: ${stats.tenants}`);
  console.log(`Occupied: ${stats.occupied} | Vacant: ${stats.vacant}`);
  console.log(`Tenants in arrears: ${stats.inArrears} ($${stats.arrearsTotal.toLocaleString()})`);
  console.log(`\nLegal cases: ${stats.legalCases}`);
  for (const [stage, count] of Object.entries(stats.legalByStage)) {
    console.log(`  ${stage}: ${count}`);
  }
  console.log(`\nViolations: A=${stats.violations.A} B=${stats.violations.B} C=${stats.violations.C} (Total: ${stats.violations.A + stats.violations.B + stats.violations.C})`);
  console.log(`\nWork Orders: OPEN=${stats.workOrders.OPEN} IN_PROGRESS=${stats.workOrders.IN_PROGRESS} COMPLETED=${stats.workOrders.COMPLETED}`);
  console.log(`\nUtility meters: ${stats.meters}`);
  console.log(`\nTenant notes: ${stats.notes}`);
  console.log(`Payments: ${stats.payments}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
