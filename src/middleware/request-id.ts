import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export function withRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") || randomUUID();
}
