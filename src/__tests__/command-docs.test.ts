import { describe, expect, it } from "vitest";
import { resolveCommandDocPath } from "@/lib/command-docs";

describe("command docs path resolution", () => {
  it("allows direct markdown files in docs", () => {
    const resolved = resolveCommandDocPath("TRACKER.md");
    expect(resolved).toMatch(/docs[\\/]+TRACKER\.md$/);
  });

  it("allows only the explicit root-doc allowlist", () => {
    const resolved = resolveCommandDocPath("README.md");
    expect(resolved).toMatch(/README\.md$/);
  });

  it("rejects path traversal attempts", () => {
    expect(resolveCommandDocPath("../.env")).toBeNull();
    expect(resolveCommandDocPath("docs/../.env")).toBeNull();
  });

  it("rejects non-markdown files outside the allowlist", () => {
    expect(resolveCommandDocPath(".env")).toBeNull();
  });
});
