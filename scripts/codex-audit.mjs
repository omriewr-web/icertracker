#!/usr/bin/env node

/**
 * Codex Audit Script — calls Anthropic API directly.
 * Reads key source files, sends them with the audit prompt to claude-sonnet-4-20250514,
 * writes the response to docs/audits/audit-YYYY-MM-DD-HHMM-codex.md
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, "docs", "audits");
const PROMPT_FILE = join(AUDIT_DIR, "CODEX-AUDIT-PROMPT.md");

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

// ── Gather codebase context ─────────────────────────────────────

const SCAN_DIRS = [
  "prisma",
  "src/lib",
  "src/app/api",
  "src/middleware.ts",
  "src/hooks",
];

const SKIP_PATTERNS = [
  "node_modules", ".next", ".claude/worktrees", "__tests__",
  ".test.", ".spec.", "seed-demo", "reset-demo",
];

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".prisma"]);
const MAX_FILE_SIZE = 30_000; // 30KB per file
const MAX_TOTAL_CHARS = 400_000; // ~100K tokens budget for context

function shouldInclude(filePath) {
  const rel = relative(ROOT, filePath);
  if (SKIP_PATTERNS.some((p) => rel.includes(p))) return false;
  if (!ALLOWED_EXTENSIONS.has(extname(filePath))) return false;
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return false;
  } catch { return false; }
  return true;
}

function collectFiles(dir) {
  const results = [];
  const fullPath = join(ROOT, dir);
  if (!existsSync(fullPath)) return results;

  const stat = statSync(fullPath);
  if (stat.isFile()) {
    if (shouldInclude(fullPath)) results.push(fullPath);
    return results;
  }

  try {
    const entries = readdirSync(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(fullPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(relative(ROOT, entryPath)));
      } else if (entry.isFile() && shouldInclude(entryPath)) {
        results.push(entryPath);
      }
    }
  } catch {}
  return results;
}

console.log("Gathering codebase files...");
let allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...collectFiles(dir));
}

// Build context string with budget
let contextChars = 0;
const fileContents = [];
for (const filePath of allFiles) {
  try {
    const content = readFileSync(filePath, "utf-8");
    const rel = relative(ROOT, filePath);
    const entry = `\n--- ${rel} ---\n${content}\n`;
    if (contextChars + entry.length > MAX_TOTAL_CHARS) {
      console.log(`Budget reached at ${fileContents.length} files (${(contextChars / 1000).toFixed(0)}K chars)`);
      break;
    }
    fileContents.push(entry);
    contextChars += entry.length;
  } catch {}
}

console.log(`Collected ${fileContents.length} files (${(contextChars / 1000).toFixed(0)}K chars)`);

// ── Get git info ────────────────────────────────────────────────

let commitHash = "unknown";
let gitStatus = "unknown";
try {
  commitHash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  const statusOutput = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
  gitStatus = statusOutput ? "Dirty" : "Clean worktree";
} catch {}

// ── Read audit prompt ───────────────────────────────────────────

const auditPrompt = readFileSync(PROMPT_FILE, "utf-8");

// ── Read TRACKER.md for context ─────────────────────────────────

let trackerContent = "";
try {
  trackerContent = readFileSync(join(ROOT, "docs", "TRACKER.md"), "utf-8");
} catch {}

// ── Call Anthropic API ───────────────────────────────────────────

const now = new Date();
const timestamp = now.toISOString().replace("T", " ").slice(0, 16) + " UTC";
const fileTimestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 12);

const systemMessage = `You are a code auditor. You read source code and produce structured audit reports. You never modify files. Current date: ${timestamp}. Current commit: ${commitHash}. Git status: ${gitStatus}.`;

const userMessage = `${auditPrompt}

---

## Current TRACKER.md (for cross-referencing already-done items)

${trackerContent.slice(0, 10000)}

---

## Codebase (${fileContents.length} files)

${fileContents.join("")}

---

Write your audit report now. Use the exact format from the prompt. The output filename should be: docs/audits/audit-${fileTimestamp}-codex.md`;

console.log("Calling Anthropic API (claude-sonnet-4-20250514)...");

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: systemMessage,
    messages: [
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
  }),
});

if (!response.ok) {
  const errBody = await response.text();
  console.error(`Anthropic API error ${response.status}: ${errBody}`);
  process.exit(1);
}

const data = await response.json();
const reportContent = data.content?.[0]?.text;

if (!reportContent) {
  console.error("No content in Anthropic response");
  process.exit(1);
}

// ── Write report ────────────────────────────────────────────────

const outputFile = join(AUDIT_DIR, `audit-${fileTimestamp}-codex.md`);
writeFileSync(outputFile, reportContent, "utf-8");
console.log(`Audit report written to: ${outputFile}`);
console.log(`Tokens: input=${data.usage?.input_tokens || "?"} output=${data.usage?.output_tokens || "?"}`);
process.exit(0);
