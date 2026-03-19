import { NextRequest, NextResponse } from "next/server";
import { verifyCommandSession } from "@/lib/command-auth";
import { resolveCommandDocPath } from "@/lib/command-docs";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const DOCS_DIR = path.join(process.cwd(), "docs");
const ROOT_DOCS = ["README.md", "CLAUDE.md"];

export async function GET(req: NextRequest) {
  if (!(await verifyCommandSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const file = url.searchParams.get("file");

  if (file) {
    // Return specific file content
    try {
      const filePath = resolveCommandDocPath(file);
      if (!filePath) {
        return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
      }

      const content = await fs.readFile(filePath, "utf-8");
      const stat = await fs.stat(filePath);
      return NextResponse.json({ name: file, content, lastModified: stat.mtime.toISOString() });
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  }

  // List all doc files
  try {
    const docsEntries = await fs.readdir(DOCS_DIR);
    const docFiles = docsEntries.filter((f) => f.endsWith(".md"));

    const files = await Promise.all(
      docFiles.map(async (name) => {
        const stat = await fs.stat(path.join(DOCS_DIR, name));
        return { name, lastModified: stat.mtime.toISOString(), dir: "docs" };
      })
    );

    // Add root-level docs
    for (const rootDoc of ROOT_DOCS) {
      try {
        const stat = await fs.stat(path.join(process.cwd(), rootDoc));
        files.push({ name: rootDoc, lastModified: stat.mtime.toISOString(), dir: "root" });
      } catch {
        // Skip if not found
      }
    }

    files.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}
