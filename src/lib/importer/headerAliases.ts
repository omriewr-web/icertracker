// Hard alias mapping: normalized header → AtlasPM schema field.
// Keys are schema fields, values are known header variations (all lowercase, normalized).

export const TENANT_ALIASES: Record<string, string[]> = {
  unit: [
    "unit", "apt", "apt number", "apartment", "apartment number",
    "unit number", "unit no", "suite", "space", "unit id",
  ],
  tenant_code: [
    "tenant code", "tcode", "t code", "resident id", "tenant id",
    "customer id", "account number", "account", "resident code",
  ],
  full_name: [
    "name", "tenant name", "resident name", "full name", "resident",
    "tenant", "lessee", "occupant", "full name",
  ],
  first_name: ["first name", "first", "fname"],
  last_name: ["last name", "last", "lname", "surname"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "contact phone"],
  email: ["email", "email address", "e mail", "contact email"],
  occupancy_status: [
    "status", "tenant status", "occupancy status", "occupancy",
    "lease status", "unit status",
  ],
  move_in_date: ["move in", "move in date", "movein date", "movein", "moved in"],
  move_out_date: ["move out", "move out date", "moveout date", "moveout", "moved out"],
  lease_start_date: [
    "lease start", "lease start date", "lease from", "lease begin",
    "start date", "lease commencement",
  ],
  lease_end_date: [
    "lease end", "lease expiration", "lease to", "lease end date",
    "end date", "expiration", "expiration date", "lease exp",
  ],
  monthly_rent: [
    "rent", "monthly rent", "contract rent", "actual rent",
    "amount", "charge amount", "total charges",
  ],
  market_rent: [
    "market rent", "market", "asking rent", "scheduled rent",
    "legal rent", "base rent",
  ],
  current_balance: [
    "balance", "current balance", "tenant balance", "outstanding balance",
    "amount due", "total balance", "balance due", "amount owed",
    "ar balance", "delinquent",
  ],
  security_deposit: [
    "deposit", "security deposit", "sec dep", "resident deposit",
  ],
  subsidy_amount: [
    "subsidy amount", "subsidy", "hap", "hap amount",
    "section 8 amount", "voucher amount",
  ],
  subsidy_type: [
    "subsidy type", "program", "voucher type", "section 8",
  ],
  arrears_status: [
    "arrears status", "arrears", "delinquency status", "collection status",
  ],
  notes: ["notes", "comments", "memo", "remarks"],
  building_id: [
    "building id", "building", "property", "property name",
    "building name", "property code", "project", "site",
  ],
};

export const BUILDING_ALIASES: Record<string, string[]> = {
  building_id: [
    "building id", "yardi code", "yardi id", "property code",
    "building code", "property id",
  ],
  address: [
    "address", "property address", "building address",
    "street address", "street", "location",
  ],
  zip: ["zip", "zip code", "zipcode", "postal code", "postal"],
  borough: ["borough", "region", "area", "county", "district"],
  block: ["block", "tax block"],
  lot: ["lot", "tax lot"],
  bin: ["bin", "bin dob", "bin number", "bin dob"],
  units: ["units", "unit count", "total units", "num units", "number of units"],
  portfolio: ["portfolio"],
  entity: ["entity", "legal entity", "owner entity", "llc"],
  owner_name: ["owner", "owner name", "property owner", "landlord"],
  property_manager: ["property manager", "manager", "pm", "site manager"],
  year_built: ["year built", "year of construction", "built", "construction year"],
  floors: ["floors", "number of floors", "stories", "floor count"],
  elevator: ["elevator", "has elevator"],
  sprinkler_system: ["sprinkler system", "sprinkler", "sprinklers"],
  fire_alarm_system: ["fire alarm system", "fire alarm", "fire safety"],
  oil_tank: [
    "oil tank", "petroleum bulk storage", "petroleum bulk storage oil tank",
    "pbs", "fuel tank",
  ],
  boiler_type: ["boiler type", "boiler", "heating type", "heat type"],
  hpd_registration_id: [
    "hpd registration id", "hpd registration", "hpd reg",
    "hpd id", "registration id",
  ],
  ein_number: ["ein number", "ein", "tax id"],
};

/** All aliases merged, keyed by normalized alias → schema field */
function buildReverseMap(aliases: Record<string, string[]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [field, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      map.set(alias, field);
    }
  }
  return map;
}

export const TENANT_ALIAS_MAP = buildReverseMap(TENANT_ALIASES);
export const BUILDING_ALIAS_MAP = buildReverseMap(BUILDING_ALIASES);

/** All schema fields by import type */
export const SCHEMA_FIELDS = {
  tenant: Object.keys(TENANT_ALIASES),
  building: Object.keys(BUILDING_ALIASES),
} as const;

/** Required fields by import type */
export const REQUIRED_FIELDS: Record<string, string[]> = {
  tenant: ["unit", "full_name"],
  building: ["address"],
  yardi_rent_roll: ["unit"],
  arrears_report: ["unit", "current_balance"],
};
