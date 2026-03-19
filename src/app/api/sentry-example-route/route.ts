export const dynamic = "force-dynamic";

export function GET() {
  throw new Error("Sentry server-side test error");
}
