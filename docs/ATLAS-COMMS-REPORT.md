# Atlas Comms V1 — Implementation Report

Date: 2026-03-19

## Files Created

### Schema
- `prisma/schema.prisma` — Added 7 models, 7 enums (Conversation, ConversationMember, Message, MessageAttachment, MessageReaction, MessageMention, PinnedMessage)

### Service Layer
- `src/lib/comms/conversation.service.ts` — Conversation CRUD, entity threads, members, archive, mute, mark-read
- `src/lib/comms/message.service.ts` — Send, system events, list with sender names, reactions, pin, delete
- `src/lib/comms/work-order-events.service.ts` — Work order lifecycle event emitters

### API Routes
- `src/app/api/comms/conversations/route.ts` — GET (list) / POST (create DM or group)
- `src/app/api/comms/conversations/[id]/route.ts` — GET (detail) / PATCH (archive, mute)
- `src/app/api/comms/conversations/[id]/messages/route.ts` — GET (list) / POST (send)
- `src/app/api/comms/conversations/[id]/mark-read/route.ts` — POST
- `src/app/api/comms/conversations/[id]/members/route.ts` — POST (add) / DELETE (remove)
- `src/app/api/comms/entity-thread/route.ts` — GET (generic entity thread for work_order, building, unit, tenant)
- `src/app/api/comms/search/route.ts` — GET (full-text message search)
- `src/app/api/comms/unread-count/route.ts` — GET

### Hooks
- `src/hooks/use-comms.ts` — useConversations, useConversationDetail, useMessages, useSendMessage, useCreateConversation, useEntityThread, useMarkRead, useUnreadCount, useConversationActions

### UI Components
- `src/components/comms/CommsLayout.tsx` — Two-panel layout (sidebar + conversation view)
- `src/components/comms/ConversationSidebar.tsx` — Tabs (All/DMs/Groups/WO/Unread), search, conversation list with entity labels
- `src/components/comms/ConversationView.tsx` — Header, messages list, pinned messages, composer
- `src/components/comms/MessageBubble.tsx` — User messages, system events, blocker/approval styling, reactions, attachments
- `src/components/comms/MessageComposer.tsx` — Auto-expanding textarea, Enter-to-send, message type selector (standard/blocker/approval)
- `src/components/comms/NewConversationModal.tsx` — DM/group creation, member search, record linking (RecordPicker integrated)
- `src/components/comms/EntityChatTab.tsx` — Generic chat tab for any operational record detail page

### Pages
- `src/app/(dashboard)/comms/page.tsx` — Main Communications hub
- `src/app/(dashboard)/comms/direct/page.tsx` — Direct messages view
- `src/app/(dashboard)/comms/groups/page.tsx` — Group chats view
- `src/app/(dashboard)/comms/work-orders/page.tsx` — Work order threads view
- `src/app/(dashboard)/comms/unread/page.tsx` — Unread messages view

### Documentation
- `docs/ATLAS-COMMS-PREFLIGHT.md` — Preflight findings
- `docs/ATLAS-COMMS-REPORT.md` — This file

## Files Modified

### Work Order Integration
- `src/app/api/work-orders/[id]/route.ts` — Added event emissions for status, priority, assignment, vendor, completion changes (fire-and-forget, try/catch wrapped)
- `src/app/api/work-orders/route.ts` — Added creation event emission on POST

### Chat Tabs on Detail Pages
- `src/components/maintenance/work-order-detail-modal.tsx` — Added "Chat" tab using EntityChatTab
- `src/app/(dashboard)/collections/[tenantId]/page.tsx` — Added "Discussion" section with EntityChatTab

### Navigation
- `src/components/layout/sidebar.tsx` — Added Communications nav item with unread badge

## Schema Changes Summary
- 7 new models: Conversation, ConversationMember, Message, MessageAttachment, MessageReaction, MessageMention, PinnedMessage
- 7 new enums: ConversationType, ConversationVisibility, ConversationMemberRole, NotificationLevel, MessageType
- All models use `String @id @default(cuid())` matching existing convention
- All models have appropriate `@@index` and `@@unique` constraints
- All tables mapped with `@@map("snake_case_name")`

## API Routes Created
| Method | Route | Purpose |
|--------|-------|---------|
| GET | /api/comms/conversations | List user's conversations |
| POST | /api/comms/conversations | Create DM or group |
| GET | /api/comms/conversations/[id] | Conversation detail |
| PATCH | /api/comms/conversations/[id] | Archive, mute |
| GET | /api/comms/conversations/[id]/messages | List messages |
| POST | /api/comms/conversations/[id]/messages | Send message |
| POST | /api/comms/conversations/[id]/mark-read | Mark read |
| POST | /api/comms/conversations/[id]/members | Add members |
| DELETE | /api/comms/conversations/[id]/members | Remove member |
| GET | /api/comms/entity-thread | Get/create entity thread |
| GET | /api/comms/search | Search messages |
| GET | /api/comms/unread-count | Unread count |

## Deviations from Prompt

1. **Session shape:** Used `user.organizationId` (not `user.orgId`) matching existing codebase convention
2. **API auth pattern:** Used `withAuth(handler, "dash")` matching existing pattern instead of raw `getServerSession`
3. **Entity thread:** The entity-thread route verifies building access using `canAccessBuilding()` from data-scope.ts for proper authorization
4. **Building/Unit detail pages:** These are modals (not pages), so Chat tabs could not be added as page-level tabs. Added Chat tab to Work Order modal and Discussion section to Tenant page. Building and Unit modals are minimal and do not have a tab system — deferred to V2.
5. **RecordPicker:** Integrated directly into NewConversationModal rather than as a separate component, since it's only used there in V1
6. **File uploads:** Not implemented — requires Supabase Storage bucket creation and client-side upload flow. Added as known issue.

## Known Issues / Limitations

1. **Polling-based realtime:** Messages refresh every 5s, unread count every 30s. No WebSocket/Supabase Realtime.
2. **No file upload:** Attachment infrastructure exists in the schema but upload UI is not wired. Needs `comms-attachments` Supabase Storage bucket.
3. **V2 entity types:** violation, legal_case, turnover, collections_case, incident return 501
4. **No @mention autocomplete:** Mentions are tracked server-side but MessageComposer does not offer user autocomplete
5. **Building/Unit modals:** Chat tabs not yet added to these modals (they are minimal and lack tab systems)
6. **Pre-existing TS error:** `utilities/accounts/route.ts` has a `leaseStart` → `leaseStatus` typo (not introduced by Comms)

## Phase 2 Recommendations

1. **Supabase Realtime:** Subscribe to `messages` and `conversations` table changes for instant updates
2. **File uploads:** Create `comms-attachments` bucket, add client upload component, wire into MessageComposer
3. **@mention autocomplete:** Add user search dropdown triggered by `@` in MessageComposer
4. **V2 entity threads:** Implement violation, legal_case, turnover entity thread types
5. **Building/Unit chat tabs:** Add Discussion sections to building and unit detail modals
6. **Message search UI:** Add a dedicated search panel in ConversationSidebar
7. **Notification system:** Push notifications for mentions and messages in non-muted conversations
8. **AI summaries:** Summarize conversation threads using existing Anthropic API integration
9. **Read receipts:** Show who has read messages in group conversations
10. **Message editing:** Allow users to edit their own messages within a time window

## TypeScript Error Count
- Before: 0 (excluding pre-existing utilities/accounts error)
- After: 0 (same pre-existing error remains, zero new errors introduced)
