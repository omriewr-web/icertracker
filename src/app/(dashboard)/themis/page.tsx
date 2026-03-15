import { Suspense } from "react";
import ThemisContent from "./themis-content";

export default function ThemisPage() {
  return (
    <Suspense>
      <ThemisContent />
    </Suspense>
  );
}
