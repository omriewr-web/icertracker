"use client";

import BuildingDetailModal from "@/components/building/building-detail-modal";
import BuildingFormModal from "@/components/building/building-form-modal";
import TenantCreateModal from "@/components/tenant/tenant-create-modal";
import AiChatPanel from "@/components/ai/ai-chat-panel";

export default function GlobalModals() {
  return (
    <>
      <BuildingDetailModal />
      <BuildingFormModal />
      <TenantCreateModal />
      <AiChatPanel />
    </>
  );
}
