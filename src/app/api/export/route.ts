  const scope = getTenantScope(user, buildingId);
  if (scope === EMPTY_SCOPE) {
    return new NextResponse("No data", { status: 204 });
  }
  const where = { ...scope };


  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      unit: { include: { building: { select: { id: true, address: true, altAddress: true, region: true, entity: true, portfolio: true } } } },
      legalCases: { where: { isActive: true }, select: { inLegal: true, stage: true }, take: 1 },
      _count: { select: { notes: true, payments: true, tasks: true } },
    },
    orderBy: { balance: "desc" },
  });


  const views = tenants.map((t) => ({
    id: t.id,
    unitId: t.unitId,
    yardiResidentId: t.yardiResidentId,
    name: t.name,
    email: t.email,
    phone: t.phone,
    unitNumber: t.unit.unitNumber,
    unitType: t.unit.unitType,
    buildingId: t.unit.building.id,
    buildingAddress: t.unit.building.address,
    altAddress: t.unit.building.altAddress ?? "",
    region: t.unit.building.region ?? "",
    entity: t.unit.building.entity ?? "",
    portfolio: t.unit.building.portfolio ?? "",
    marketRent: t.marketRent,
    legalRent: t.legalRent,
    prefRent: t.prefRent,
    chargeCode: t.chargeCode ?? "",
    balance: t.balance,
    deposit: t.deposit,
    arrears: (t as any).arrears,
    arrearsCategory: (t as any).arrearsCategory,
    arrearsDays: (t as any).arrearsDays,
    monthsOwed: (t as any).monthsOwed,
    leaseStatus: t.leaseStatus,
    leaseExpiration: t.leaseExpiration,
    moveInDate: t.moveInDate,
    moveOutDate: t.moveOutDate,
    collectionScore: (t as any).collectionScore,
    collectionStatus: (t as any).collectionStatus,
    legalFlag: (t as any).legalFlag,
    legalStage: t.legalCases?.[0]?.stage ?? "",
    noteCount: t._count.notes,
    paymentCount: t._count.payments,
    taskCount: t._count.tasks,
    buildingRegion: t.unit.building.region ?? "",
    monthlyRent: t.marketRent,
  })) as unknown as TenantView[];


  const filename = `tenants-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = exportToExcel(views, filename);


  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

