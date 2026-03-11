// Simple violation sync script — calls the local dev server API
// Usage: node scripts/sync-violations.js
//
// Requires CRON_SECRET in your .env file.
// Add to .env:  CRON_SECRET=your-secret-here

const path = require("path");
const fs = require("fs");

// Load CRON_SECRET from .env
const envPath = path.join(__dirname, "..", ".env");
let cronSecret = "";
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf-8");
  const match = env.match(/^CRON_SECRET=(.+)$/m);
  if (match) cronSecret = match[1].trim().replace(/^["']|["']$/g, "");
}

if (!cronSecret) {
  console.error("CRON_SECRET not found in .env — add CRON_SECRET=your-secret-here");
  process.exit(1);
}

const API_URL = "http://localhost:3000/api/violations/sync";

async function main() {
  const ts = new Date().toLocaleString();
  console.log(`[${ts}] Starting violation sync...`);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[${ts}] Sync failed (HTTP ${res.status}): ${text}`);
      process.exit(1);
    }

    // Response is SSE stream — read all events
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      try {
        const msg = JSON.parse(line.slice(6));
        if (msg.type === "progress") {
          console.log(`  Progress: ${msg.synced}/${msg.total} buildings (batch: +${msg.batchNew} new, +${msg.batchUpdated} updated)`);
        } else if (msg.type === "done") {
          console.log(`[${ts}] Sync complete: ${msg.totalNew} new, ${msg.totalUpdated} updated, ${msg.totalErrors} errors`);
        } else if (msg.type === "error") {
          console.error(`[${ts}] Sync error: ${msg.message}`);
        }
      } catch { /* skip malformed lines */ }
    }
  } catch (err) {
    console.error(`[${ts}] Failed to connect to dev server: ${err.message}`);
    console.error("  Make sure the Next.js dev server is running (npm run dev)");
    process.exit(1);
  }
}

main();
