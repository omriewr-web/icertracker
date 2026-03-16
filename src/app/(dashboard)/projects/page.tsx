import { Suspense } from "react";
import ProjectsContent from "./projects-content";

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsContent />
    </Suspense>
  );
}
