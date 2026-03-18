import Badge from "@/components/ui/badge";
import { getArrearsCategoryInfo } from "@/lib/constants/statuses";

export default function ArrearsBadge({ category }: { category: string }) {
  const { label, variant } = getArrearsCategoryInfo(category);
  return <Badge variant={variant as any}>{label}</Badge>;
}
