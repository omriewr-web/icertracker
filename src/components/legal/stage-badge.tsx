import Badge from "@/components/ui/badge";
import { getLegalStageInfo } from "@/lib/constants/statuses";

export default function StageBadge({ stage }: { stage: string }) {
  const { label, variant } = getLegalStageInfo(stage);
  return <Badge variant={variant as any}>{label}</Badge>;
}
