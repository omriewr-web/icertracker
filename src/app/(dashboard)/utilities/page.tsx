import { Suspense } from "react";
import UtilitiesContent from "./utilities-content";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function UtilitiesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UtilitiesContent />
    </Suspense>
  );
}
