/**
 * Generate all 8 AtlasPM import templates as .xlsx files.
 * Run: npx tsx scripts/generate-templates.ts
 */
import XLSX from "xlsx";
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "templates");
fs.mkdirSync(OUT_DIR, { recursive: true });

interface TemplateConfig {
  filename: string;
  sheetName: string;
  headers: string[];
  example: (string | number)[];
  readme: string[][];
}

function createTemplate(config: TemplateConfig) {
  const wb = XLSX.utils.book_new();

  // Data sheet
  const wsData = [config.headers, config.example];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = config.headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

  XLSX.utils.book_append_sheet(wb, ws, config.sheetName);

  // README sheet
  const readmeWs = XLSX.utils.aoa_to_sheet([
    ["Column", "Description", "Required", "Valid Values / Tips"],
    ...config.readme,
  ]);
  readmeWs["!cols"] = [{ wch: 22 }, { wch: 50 }, { wch: 10 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, readmeWs, "README");

  const filePath = path.join(OUT_DIR, config.filename);
  XLSX.writeFile(wb, filePath);
  console.log(`  ✓ ${config.filename}`);
}

const templates: TemplateConfig[] = [
  {
    filename: "AtlasPM_Buildings_Template.xlsx",
    sheetName: "Buildings",
    headers: ["Address", "Borough", "Block", "Lot", "Total Units", "Building Type", "Portfolio Name", "Year Built", "HPD Registration Number"],
    example: ["123 Main Street", "Manhattan", "01234", "0056", 24, "Residential", "Portfolio A", 1965, "000123456"],
    readme: [
      ["Address", "Street address of the building", "Yes", "e.g. 123 Main Street"],
      ["Borough", "NYC borough", "Yes", "Manhattan, Brooklyn, Queens, Bronx, Staten Island"],
      ["Block", "Tax block number", "No", "Leading zeros OK, e.g. 01234"],
      ["Lot", "Tax lot number", "No", "Leading zeros OK, e.g. 0056"],
      ["Total Units", "Number of units in building", "No", "Whole number"],
      ["Building Type", "Type of building", "No", "Residential, Mixed Use, Commercial"],
      ["Portfolio Name", "Portfolio grouping", "No", "Free text, used for filtering"],
      ["Year Built", "Year the building was constructed", "No", "4-digit year"],
      ["HPD Registration Number", "HPD registration ID", "No", "Numeric ID from HPD"],
    ],
  },
  {
    filename: "AtlasPM_Units_Template.xlsx",
    sheetName: "Units",
    headers: ["Building Address", "Unit Number", "Bedrooms", "Bathrooms", "Sq Ft", "Legal Rent", "Market Rent", "Preferential Rent", "Status", "Rent Stabilized"],
    example: ["123 Main Street", "4A", 2, 1, 850, 1800, 2200, 1900, "occupied", "yes"],
    readme: [
      ["Building Address", "Must match a building already in the system", "Yes", "Exact address or close match"],
      ["Unit Number", "Apartment/unit identifier", "Yes", "e.g. 4A, 101, STORE"],
      ["Bedrooms", "Number of bedrooms", "No", "Whole number, 0 for studio"],
      ["Bathrooms", "Number of bathrooms", "No", "Whole number or decimal (1.5)"],
      ["Sq Ft", "Square footage", "No", "Whole number"],
      ["Legal Rent", "DHCR legal rent amount", "No", "Dollar amount without $"],
      ["Market Rent", "Current market rent", "No", "Dollar amount without $"],
      ["Preferential Rent", "Preferential rent if applicable", "No", "Dollar amount without $"],
      ["Status", "Occupancy status", "No", "vacant or occupied"],
      ["Rent Stabilized", "Is the unit rent stabilized?", "No", "yes or no"],
    ],
  },
  {
    filename: "AtlasPM_Tenants_Template.xlsx",
    sheetName: "Tenants",
    headers: ["Building Address", "Unit Number", "First Name", "Last Name", "Email", "Phone", "Lease Start", "Lease End", "Monthly Rent", "Security Deposit", "Balance", "Move In Date"],
    example: ["123 Main Street", "4A", "John", "Smith", "john@email.com", "212-555-1234", "2024-01-01", "2025-12-31", 1900, 1900, 0, "2024-01-01"],
    readme: [
      ["Building Address", "Must match a building in the system", "Yes", "Exact address or close match"],
      ["Unit Number", "Must match a unit in the building", "Yes", "e.g. 4A"],
      ["First Name", "Tenant first name", "Yes", ""],
      ["Last Name", "Tenant last name", "Yes", ""],
      ["Email", "Tenant email address", "No", "Valid email format"],
      ["Phone", "Tenant phone number", "No", "Any format: 212-555-1234 or (212) 555-1234"],
      ["Lease Start", "Lease start date", "No", "YYYY-MM-DD format"],
      ["Lease End", "Lease expiration date", "No", "YYYY-MM-DD format"],
      ["Monthly Rent", "Current monthly rent amount", "No", "Dollar amount without $"],
      ["Security Deposit", "Security deposit amount", "No", "Dollar amount without $"],
      ["Balance", "Current outstanding balance", "No", "Dollar amount without $, 0 if current"],
      ["Move In Date", "Date tenant moved in", "No", "YYYY-MM-DD format"],
    ],
  },
  {
    filename: "AtlasPM_WorkOrders_Template.xlsx",
    sheetName: "Work Orders",
    headers: ["Building Address", "Unit Number", "Title", "Description", "Priority", "Category", "Status", "Assigned To", "Created Date", "Completed Date", "Cost"],
    example: ["123 Main Street", "4A", "Leaking faucet", "Kitchen faucet dripping constantly", "medium", "plumbing", "open", "John Doe", "2024-03-15", "", 0],
    readme: [
      ["Building Address", "Must match a building in the system", "Yes", ""],
      ["Unit Number", "Unit if applicable", "No", "Leave blank for common area"],
      ["Title", "Short title for the work order", "Yes", "e.g. Leaking faucet"],
      ["Description", "Detailed description", "No", "Full description of the issue"],
      ["Priority", "Priority level", "No", "low, medium, high, emergency"],
      ["Category", "Work category", "No", "plumbing, electric, hvac, structural, pest, other"],
      ["Status", "Current status", "No", "open, in-progress, completed"],
      ["Assigned To", "Name of person assigned", "No", "Free text"],
      ["Created Date", "Date created", "No", "YYYY-MM-DD format"],
      ["Completed Date", "Date completed", "No", "YYYY-MM-DD format, leave blank if not done"],
      ["Cost", "Actual cost", "No", "Dollar amount without $"],
    ],
  },
  {
    filename: "AtlasPM_LegalCases_Template.xlsx",
    sheetName: "Legal Cases",
    headers: ["Building Address", "Unit Number", "Tenant Name", "Balance", "Legal Stage", "Attorney Name", "Filed Date", "Next Court Date", "Index Number", "Notes"],
    example: ["123 Main Street", "4A", "John Smith", 15000, "nonpayment", "Jane Attorney", "2024-01-15", "2024-04-20", "L&T 12345/24", "Stipulation pending"],
    readme: [
      ["Building Address", "Must match a building in the system", "Yes", ""],
      ["Unit Number", "Must match a unit", "Yes", ""],
      ["Tenant Name", "Full tenant name", "Yes", "Used to match existing tenant"],
      ["Balance", "Amount owed", "No", "Dollar amount without $"],
      ["Legal Stage", "Current stage", "No", "demand, petition, court, warrant, eviction, settled"],
      ["Attorney Name", "Attorney handling the case", "No", "Full name"],
      ["Filed Date", "Date case was filed", "No", "YYYY-MM-DD"],
      ["Next Court Date", "Next scheduled court date", "No", "YYYY-MM-DD"],
      ["Index Number", "Court index number", "No", "e.g. L&T 12345/24"],
      ["Notes", "Additional notes", "No", "Free text"],
    ],
  },
  {
    filename: "AtlasPM_Vendors_Template.xlsx",
    sheetName: "Vendors",
    headers: ["Company Name", "Contact Name", "Phone", "Email", "Trade", "License Number", "Insurance Expiry", "Notes"],
    example: ["ABC Plumbing LLC", "Mike Johnson", "212-555-9876", "mike@abcplumbing.com", "plumber", "PLB-12345", "2025-06-30", "Preferred vendor for 123 Main St"],
    readme: [
      ["Company Name", "Vendor company name", "Yes", ""],
      ["Contact Name", "Primary contact person", "No", ""],
      ["Phone", "Phone number", "No", "Any format"],
      ["Email", "Email address", "No", "Valid email"],
      ["Trade", "Type of work", "No", "plumber, electrician, carpenter, super, elevator, boiler, general_contractor, other"],
      ["License Number", "Professional license number", "No", ""],
      ["Insurance Expiry", "Insurance expiration date", "No", "YYYY-MM-DD"],
      ["Notes", "Additional notes", "No", "Free text"],
    ],
  },
  {
    filename: "AtlasPM_ARBalance_Template.xlsx",
    sheetName: "AR Balances",
    headers: ["Building Address", "Unit Number", "Tenant Name", "0-30 Days", "30-60 Days", "60-90 Days", "90-120 Days", "120+ Days", "Total Balance", "Last Payment Date", "Last Payment Amount"],
    example: ["123 Main Street", "4A", "John Smith", 0, 1900, 0, 0, 0, 1900, "2024-02-01", 1900],
    readme: [
      ["Building Address", "Must match a building in the system", "Yes", ""],
      ["Unit Number", "Must match a unit", "Yes", ""],
      ["Tenant Name", "Tenant name for verification", "Yes", "Must match existing tenant"],
      ["0-30 Days", "Balance aged 0-30 days", "No", "Dollar amount"],
      ["30-60 Days", "Balance aged 30-60 days", "No", "Dollar amount"],
      ["60-90 Days", "Balance aged 60-90 days", "No", "Dollar amount"],
      ["90-120 Days", "Balance aged 90-120 days", "No", "Dollar amount"],
      ["120+ Days", "Balance aged 120+ days", "No", "Dollar amount"],
      ["Total Balance", "Total outstanding balance", "No", "Sum of all aging buckets"],
      ["Last Payment Date", "Date of last payment", "No", "YYYY-MM-DD"],
      ["Last Payment Amount", "Amount of last payment", "No", "Dollar amount"],
    ],
  },
  {
    filename: "AtlasPM_Utilities_Template.xlsx",
    sheetName: "Utilities",
    headers: ["Building Address", "Provider", "Account Number", "Meter Number", "Service Address", "Notes"],
    example: ["123 Main Street", "ConEd", "4012345678", "MTR-001", "123 Main Street Apt 1", "Common area meter"],
    readme: [
      ["Building Address", "Must match a building in the system", "Yes", ""],
      ["Provider", "Utility provider name", "Yes", "ConEd, National Grid, DEP Water, Oil, Other"],
      ["Account Number", "Utility account number", "No", "Provider account number"],
      ["Meter Number", "Meter number if known", "No", ""],
      ["Service Address", "Service address if different from building", "No", ""],
      ["Notes", "Additional notes", "No", "e.g. Common area, basement meter"],
    ],
  },
];

console.log("Generating AtlasPM import templates...");
for (const t of templates) {
  createTemplate(t);
}
console.log(`\nDone! ${templates.length} templates created in ${OUT_DIR}`);
