"use client";

import { useParams, useRouter } from "next/navigation";
import MeterDetailModal from "../meter-detail-modal";

export default function MeterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meterId = params.meterId as string;

  return (
    <MeterDetailModal
      meterId={meterId}
      onClose={() => router.push("/utilities")}
    />
  );
}
