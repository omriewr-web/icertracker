# Client Onboarding Guide

Getting a new client live on AtlasPM in under 30 minutes.

---

## Day 1 Checklist

### 1. Create the organization and admin account

Your AtlasPM admin will set this up:
- Organization name and slug
- Admin user credentials for the property manager
- Owner user credentials (if owner portal access is needed)

### 2. Import buildings

1. Go to **Data Management** → **Import** tab
2. Click **Download Template** on the Buildings card
3. Fill in: address, borough, block/lot, total units, portfolio name
4. Upload the filled template — buildings are created or matched by address

**Tip:** If you have a Yardi export, skip the template — just drag-drop the rent roll file. AtlasPM auto-detects the format.

### 3. Import tenants

1. Download the **Tenants** template
2. Fill in: building address, unit number, tenant name, rent, lease dates, balance
3. Upload — tenants are matched to buildings by address and unit number

**From Yardi:** Upload a "Rent Roll with Lease Charges" export directly. AtlasPM extracts tenants, units, rents, and balances automatically.

### 4. Set up owner logins

1. Go to **Users** → **Add User**
2. Set role to **Owner**
3. Assign the owner to their buildings
4. Share login credentials — they'll see the Owner Dashboard with building-level metrics only (no tenant PII)

---

## How to Import a Yardi Rent Roll

1. Export "Rent Roll with Lease Charges" from Yardi as .xlsx
2. Go to **Data Management** → **Import** tab
3. Drag-drop the file into the **Smart Import** zone
4. AtlasPM detects "Yardi Rent Roll" automatically
5. Review the preview: building count, tenant count, any parse warnings
6. Click **Confirm Import**
7. Done — tenants, units, balances, and lease dates are populated

## How to Sync HPD Violations

1. Go to **Compliance** → **Violations** tab
2. Click **Sync Now** in the top right
3. AtlasPM queries NYC Open Data (HPD, DOB, ECB) for your buildings
4. New violations appear with class, severity, respond-by date, and penalties
5. Class C violations are flagged red — address these first
6. Click **Create WO** on any violation to dispatch maintenance

## How to Invite a Property Manager

1. Go to **Users** → **Add User**
2. Enter name, email, username, temporary password
3. Set role to **PM** (full access) or **APM** (inherits manager's buildings)
4. Assign buildings — the PM will only see data for their assigned properties
5. Share login credentials

---

## Ongoing Workflow

| Frequency | Task |
|-----------|------|
| Daily | Check **Daily Briefing** for urgent items |
| Weekly | Review **Collections** pipeline — follow up on stale accounts |
| Monthly | Upload updated Yardi rent roll to refresh balances |
| Monthly | Run **HPD Sync** to check for new violations |
| As needed | Create work orders, update legal cases, add collection notes |

---

## Support

For setup assistance or questions:
- Email: support@myatlaspm.com
- Documentation: See `docs/` folder in the application
- Demo walkthrough: See `docs/DEMO-WALKTHROUGH.md`
