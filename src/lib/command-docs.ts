import path from "path";

const DOCS_DIR = path.join(process.cwd(), "docs");
const ROOT_DOCS = new Set(["README.md", "CLAUDE.md"]);

export function resolveCommandDocPath(file: string): string | null {
  const normalized = file.replace(/\\/g, "/").trim();
  if (!normalized || normalized.includes("\0")) {
    return null;
  }

  if (ROOT_DOCS.has(normalized)) {
    return path.join(process.cwd(), normalized);
  }

  if (normalized.includes("/") || normalized.includes("..")) {
    return null;
  }

  if (!normalized.toLowerCase().endsWith(".md")) {
    return null;
  }

  return path.join(DOCS_DIR, normalized);
}
