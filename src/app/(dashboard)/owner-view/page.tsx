import { redirect } from "next/navigation";

export default function OwnerViewRedirect() {
  redirect("/owner-dashboard");
}
