import { Suspense } from "react";
import RequestForm from "./request-form";

export default function RequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] text-text-dim">Loading...</div>}>
      <RequestForm />
    </Suspense>
  );
}
