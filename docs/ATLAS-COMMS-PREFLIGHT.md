# Atlas Comms — Preflight Report

Date: 2026-03-19

## TypeScript Error Count
- **0 errors** (clean baseline)

## Auth/Session Shape
Session user (`session.user`):
- `id: string`
- `name: string`
- `email: string`
- `role: UserRole` (SUPER_ADMIN | ADMIN | ACCOUNT_ADMIN | PM | APM | COLLECTOR | OWNER | LEASING_SPECIALIST | BROKER | SUPER | ACCOUNTING | LEASING_AGENT)
- `assignedProperties: string[]`
- `organizationId: string | null`
- `managerId: string | null`
- `onboardingComplete: boolean`
- `active: boolean`

**Note:** Session uses `organizationId`, NOT `orgId`. All API code must use `user.organizationId`.

## Org Scoping Pattern
- `withAuth()` in `src/lib/api-helpers.ts` loads fresh user from DB, checks `user.organizationId`
- Non-SUPER_ADMIN without organizationId → 401
- Data scope via `src/lib/data-scope.ts`: `getBuildingScope()`, `getTenantScope()`, `assertBuildingAccess()`, etc.
- ADMIN/ACCOUNT_ADMIN see all buildings in their org; other roles see only assigned buildings

## Prisma Client
- Export: `import { prisma } from "@/lib/prisma"` (src/lib/prisma.ts)
- ID type: `String @id @default(cuid())`

## Navigation/Sidebar
- File: `src/components/layout/sidebar.tsx`
- Uses `NavItem[]` with `{ href, label, subtitle?, icon, perm, section }` pattern
- Sections: INTELLIGENCE, FINANCIAL, OPERATIONS, LEGAL, SETTINGS
- Permission-gated via `hasPermission(role, perm)`

## Realtime Infrastructure
- No Supabase Realtime configured
- No WebSocket infrastructure
- Polling is the only option for V1

## File Upload Infrastructure
- **Supabase Storage** exists: `src/lib/supabase-storage.ts`
- Bucket: `work-order-photos`
- Max: 10MB, image-only (jpeg, png, webp, gif)
- Uses `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- Will create new `comms-attachments` bucket for this module

## Layout Pattern
- Dashboard pages: `src/app/(dashboard)/` with shared layout
- Layout: Header + Sidebar + ErrorBoundary + content area
- Pages export a default component; complex ones delegate to a `*-content.tsx` client component

## Detail Page Pattern
- **Work Orders:** Modal (`src/components/maintenance/work-order-detail-modal.tsx`) with tabs (Details, Comments, Activity, Themis)
- **Buildings:** Modal (`src/components/building/building-detail-modal.tsx`)
- **Units:** Tab within Data Management page (no standalone detail page)
- **Tenants/Collections:** Full page at `/collections/[tenantId]/page.tsx`
- Chat tabs will be added to modals as new tab, and to pages as new section

## API Route Pattern
- All use `withAuth(handler, "permission")` wrapper
- `parseBody(req, zodSchema)` for input validation
- `params` are awaited: `const { id } = await params`
- Return `NextResponse.json()`
