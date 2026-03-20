#!/usr/bin/env node

/**
 * Claude Repair Script — calls Anthropic API directly.
 * Reads the repair prompt + latest Codex audit report, sends them to Claude,
 * writes the response to docs/audits/repair-YYYYMMDD-HHMM-claude.md
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set");
  process.exit(1);
}

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, "docs", "audits");
const PROMPT_FILE = join(AUDIT_DIR, "CLAUDE-REPAIR-PROMPT.md");

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

// ── Find latest Codex audit report ──────────────────────────────

const auditFiles = readdirSync(AUDIT_DIR)
  .filter((f) => /^audit-.*-codex\.md$/.test(f))
  .sort()
  .reverse();

if (auditFiles.length === 0) {
  console.error("No Codex audit reports found in docs/audits/");
  process.exit(1);
}

const latestAudit = auditFiles[0];
const latestAuditPath = join(AUDIT_DIR, latestAudit);
const auditContent = readFileSync(latestAuditPath, "utf-8");
console.log(`Latest Codex audit: ${latestAudit}`);

// ── Read repair prompt ──────────────────────────────────────────

const repairPrompt = readFileSync(PROMPT_FILE, "utf-8");

// ── Read TRACKER.md ─────────────────────────────────────────────

let trackerContent = "";
try {
  trackerContent = readFileSync(join(ROOT, "docs", "TRACKER.md"), "utf-8");
} catch {}

// ── Gather codebase context ─────────────────────────────────────

const SCAN_DIRS = [
  "src/lib",
  "src/app/api",
  "src/middleware.ts",
  "src/hooks",
];

const SKIP_PATTERNS = [
  "node_modules", ".next", ".claude/worktrees", "__tests__",
  ".test.", ".spec.", "seed-demo", "reset-demo",
];

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs"]);
const MAX_FILE_SIZE = 30_000;
const MAX_TOTAL_CHARS = 300_000;

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

// ── Call Anthropic API ──────────────────────────────────────────

const now = new Date();
const timestamp = now.toISOString().replace("T", " ").slice(0, 16) + " UTC";
const fileTimestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 12);

const systemMessage = `You are a repair agent for the AtlasPM codebase. You analyze Codex audit findings against current source code, identify which issues are still present, and produce a structured repair report recommending specific fixes. You do NOT modify files — you produce analysis and recommendations. Current date: ${timestamp}. Current commit: ${commitHash}. Git status: ${gitStatus}.`;

const userMessage = `${repairPrompt}

---

## Latest Codex Audit Report (${latestAudit})

${auditContent}

---

## Current TRACKER.md (for cross-referencing already-done items)

${trackerContent.slice(0, 15000)}

---

## Codebase (${fileContents.length} files)

${fileContents.join("")}

---

Analyze the Codex audit findings against the current codebase. For each finding marked "Safe for unattended repair: Yes":
1. Verify the issue still exists in the provided source code
2. Skip anything already marked done in TRACKER.md
3. For issues that still exist, provide the exact fix (file path, line, old code → new code)

Write your repair report using the format from the prompt. The output filename should be: docs/audits/repair-${fileTimestamp}-claude.md`;

console.log("Calling Anthropic API (claude-sonnet-4-5-20251101)...");

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-5-20251101",
    max_tokens: 4000,
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

const outputFile = join(AUDIT_DIR, `repair-${fileTimestamp}-claude.md`);
writeFileSync(outputFile, reportContent, "utf-8");
console.log(`Repair report written to: ${outputFile}`);
console.log(`Tokens: input=${data.usage?.input_tokens || "?"} output=${data.usage?.output_tokens || "?"}`);
process.exit(0);
