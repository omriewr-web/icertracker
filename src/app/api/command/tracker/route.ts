import { NextResponse } from "next/server";
import { verifyCommandSession } from "@/lib/command-auth";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

interface TrackerTask {
  label: string;
  status: "done" | "in-progress" | "todo" | "warning";
}

interface TrackerSection {
  title: string;
  status: "done" | "in-progress" | "todo" | "warning";
  tasks: TrackerTask[];
}

interface TrackerData {
  sections: TrackerSection[];
  activeWork: string[];
  knownIssues: string[];
  lastUpdated: string;
  raw: string;
}

/**
 * Parse docs/TRACKER.md into structured sections at runtime.
 * No caching — always reads the file fresh.
 */
function parseTracker(content: string): TrackerData {
  const lines = content.split("\n");
  const sections: TrackerSection[] = [];
  const activeWork: string[] = [];
  const knownIssues: string[] = [];
  let lastUpdated = "";

  let currentSection: TrackerSection | null = null;
  let mode: "sections" | "active" | "issues" | "other" = "other";

  for (const line of lines) {
    const trimmed = line.trim();

    // Extract last updated
    if (trimmed.startsWith("Last Updated:")) {
      lastUpdated = trimmed.replace("Last Updated:", "").trim();
      continue;
    }

    // Detect section headers
    if (trimmed.startsWith("### ")) {
      const title = trimmed.replace("### ", "").trim();
      // Skip "---" separator sections
      if (title === "---") continue;
      currentSection = { title, status: "todo", tasks: [] };
      sections.push(currentSection);
      mode = "sections";
      continue;
    }

    // Detect H2 headers for Active Work / Known Issues
    if (trimmed.startsWith("## Active Work")) {
      mode = "active";
      currentSection = null;
      continue;
    }
    if (trimmed.startsWith("## Known Issues")) {
      mode = "issues";
      currentSection = null;
      continue;
    }
    if (trimmed.startsWith("## ") && mode !== "sections") {
      mode = "other";
      currentSection = null;
      continue;
    }

    // Parse checkbox items: - [x] or - [ ]
    const checkMatch = trimmed.match(/^- \[([ xX])\]\s+(.+)$/);
    if (checkMatch && currentSection && mode === "sections") {
      const isDone = checkMatch[1].toLowerCase() === "x";
      currentSection.tasks.push({
        label: checkMatch[2],
        status: isDone ? "done" : "todo",
      });
      continue;
    }

    // Parse bullet items in Active Work / Known Issues
    const bulletMatch = trimmed.match(/^- (.+)$/);
    if (bulletMatch) {
      if (mode === "active") {
        activeWork.push(bulletMatch[1]);
      } else if (mode === "issues") {
        knownIssues.push(bulletMatch[1]);
      }
    }
  }

  // Compute section status from tasks
  for (const section of sections) {
    if (section.tasks.length === 0) {
      section.status = "todo";
    } else if (section.tasks.every((t) => t.status === "done")) {
      section.status = "done";
    } else if (section.tasks.some((t) => t.status === "done")) {
      section.status = "in-progress";
    } else {
      section.status = "todo";
    }
  }

  return { sections, activeWork, knownIssues, lastUpdated, raw: content };
}

export async function GET() {
  if (!(await verifyCommandSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const trackerPath = path.join(process.cwd(), "docs", "TRACKER.md");
    const content = await fs.readFile(trackerPath, "utf-8");
    const data = parseTracker(content);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { sections: [], activeWork: [], knownIssues: [], lastUpdated: "", raw: "" },
      { status: 200 }
    );
  }
}
