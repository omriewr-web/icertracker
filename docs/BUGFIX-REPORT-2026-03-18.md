# Bugfix Report — 2026-03-18

Fixes for 3 confirmed bugs from AUDIT-TECHNICAL-2026-03-18.md, plus verification of 2 others.

## Bug 1 — OWNER role data leak in collections API (FIXED)

**Problem:** OWNER role had `collections: READ_ONLY` permission, which allowed GET access to tenant-level collections data — individual balances, notes, collection scores, AI recommendations.

**Root cause:** `withAuth("collections")` checks `hasPermission()` which returns true for READ_ONLY. No additional role check existed on GET routes.

**Fix:** Added `if (user.role === "OWNER") return 403` to 5 tenant-level routes:
- `GET /api/collections/tenants` — tenant list with balances
- `GET /api/collections/tenants/[id]` — tenant collection profile
- `GET /api/collections/tenants/[id]/ai-recommend` — AI recommendations
- `GET /api/collections/tenants/[id]/notes` — collection notes
- `GET /api/collections/alerts` — tenant-level alerts

**Kept open for OWNER** (aggregate data only):
- `GET /api/collections/dashboard` — portfolio totals
- `GET /api/collections/report` — building-level aging buckets

**Commit:** `ebfe048`

---

## Bug 5 — OWNER role can navigate to internal management pages (FIXED)

**Problem:** Middleware only checked authentication, not role-based access. OWNER users could navigate directly to `/data`, `/users`, `/collections`, `/alerts`, `/settings` by typing the URL.

**Root cause:** No role-based route blocking in `src/middleware.ts`.

**Fix:** Added OWNER role guard in middleware. When OWNER navigates to blocked paths, they are redirected to `/owner-dashboard`.

**Blocked paths:** `/data`, `/users`, `/collections`, `/alerts`, `/settings`

**Still accessible to OWNER** (read-only operational views): `/owner-dashboard`, `/owner/*`, `/vacancies`, `/leases`, `/maintenance`, `/projects`, `/legal`, `/compliance`, `/reports`

**Commit:** `b44c562`

---

## Bug 7 — Public request form honeypot not working (FIXED)

**Problem:** The hidden honeypot `<input name="website">` existed in the HTML form, but the form submission function used `JSON.stringify({ ...form, token })` where `form` is a React state object that never included the `website` field. Bots that auto-filled the hidden field were not caught.

**Root cause:** Disconnect between DOM form fields and React state. The honeypot value was never read from the DOM or included in the JSON POST body.

**Fix:** `handleSubmit` now reads the honeypot value from the form element via `formEl.elements.namedItem("website")` and includes it in the POST body when non-empty. The API-side check (`if (body.website) return fake 201`) was already correct.

**Commit:** `d306999`

---

## Bug 2 — Org scoping fail-closed (VERIFIED — NOT A BUG)

**Finding:** `getBuildingScope()` in `src/lib/data-scope.ts` correctly returns `EMPTY_SCOPE` when:
- Non-admin user has empty `assignedProperties` array → line 75 returns `EMPTY_SCOPE`
- Non-admin user has null `assignedProperties` → `?? []` defaults to empty → same path
- Non-SUPER_ADMIN with no `organizationId` → line 53 returns `EMPTY_SCOPE`

No fallback to broad queries exists. Fail-closed behavior is correct.

---

## Bug 6 — Collections status vocabulary drift (VERIFIED — PRESENT, NOT FIXED)

**Finding:** Status vocabulary drift is severe and confirmed:

| Source | Values |
|--------|--------|
| UI (collections-content.tsx) | monitoring, demand_sent, legal_referred, payment_plan, resolved |
| Schema comment (CollectionCase.status) | new_arrears, reminder_sent, payment_plan, notice_served, legal_review, legal_filed |
| Service (collections.service.ts sendToLegal) | legal_referred |

Only `payment_plan` overlaps between UI and schema comment. However, the DB field is `String` not an enum, so no constraint violations occur — the drift is semantic, not crash-causing.

**Status:** This is a known W1-C issue (status vocabulary normalization) tracked in CLAUDE.md Wave Plan. Not fixed in this pass per scope rules.
