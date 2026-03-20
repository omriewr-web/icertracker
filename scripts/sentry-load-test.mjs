#!/usr/bin/env node
/**
 * Sentry Load Test — generates live error and performance data
 * Usage:
 *   node scripts/sentry-load-test.mjs          # run forever (30s interval)
 *   node scripts/sentry-load-test.mjs --once    # single cycle then exit
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Load .env.local ────────────────────────────────────────────
function loadEnv() {
  try {
    const content = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      let val = trimmed.slice(eqIdx + 1);
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local may not exist in CI — env vars come from secrets
  }
}
loadEnv();

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://www.myatlaspm.com";
const ONCE = process.argv.includes("--once");

if (!DSN) {
  console.error("ERROR: NEXT_PUBLIC_SENTRY_DSN not set. Cannot send events to Sentry.");
  process.exit(1);
}

// ── Init Sentry ────────────────────────────────────────────────
const Sentry = await import("@sentry/node");

Sentry.init({
  dsn: DSN,
  environment: "load-test",
  tracesSampleRate: 1.0,
  release: "atlaspm-load-test@1.0.0",
});

// ── Helpers ────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function log(emoji, msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`  ${emoji} [${ts}] ${msg}`);
}

async function fetchUrl(path, opts = {}) {
  const url = `${APP_URL}${path}`;
  try {
    const res = await fetch(url, { ...opts, redirect: "manual" });
    return { status: res.status, ok: res.ok, url };
  } catch (err) {
    return { status: 0, ok: false, url, error: err.message };
  }
}

// ── Scenario 1: Successful API calls ───────────────────────────
async function fireSuccessfulCalls() {
  const endpoints = [
    "/api/health",
    "/api/buildings",
    "/api/tenants",
    "/api/violations",
    "/api/work-orders",
    "/api/vacancies",
    "/api/metrics",
    "/api/collections/dashboard",
  ];

  const path = pick(endpoints);
  return Sentry.startSpan({ name: `load-test.success.${path}`, op: "http.client" }, async () => {
    const result = await fetchUrl(path);
    log("✅", `GET ${path} → ${result.status}`);
    return result;
  });
}

// ── Scenario 2: Expected errors (404s, 400s) ──────────────────
async function fireExpectedErrors() {
  const scenarios = [
    { path: "/api/tenants/nonexistent-id-00000", method: "GET", desc: "tenant 404" },
    { path: "/api/buildings/999999", method: "GET", desc: "building 404" },
    { path: "/api/tenants/bad-uuid-format", method: "GET", desc: "bad UUID" },
    { path: "/api/units/does-not-exist", method: "GET", desc: "unit 404" },
    {
      path: "/api/work-orders",
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      desc: "WO missing fields",
    },
    {
      path: "/api/buildings",
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      desc: "building missing fields",
    },
  ];

  const s = pick(scenarios);
  return Sentry.startSpan({ name: `load-test.error.${s.desc}`, op: "http.client" }, async () => {
    const result = await fetchUrl(s.path, {
      method: s.method,
      body: s.body,
      headers: s.headers,
    });
    log("⚠️", `${s.method} ${s.path} → ${result.status} (${s.desc})`);
    return result;
  });
}

// ── Scenario 3: Simulated client errors ────────────────────────
function fireSimulatedErrors() {
  const exceptions = [
    { msg: "Simulated: Tenant balance calculation failed", tags: { module: "collections" } },
    { msg: "Simulated: HPD sync timeout", tags: { module: "violations" } },
    { msg: "Simulated: Lease expiration check failed", tags: { module: "leases" } },
    { msg: "Simulated: Work order assignment failed — vendor not found", tags: { module: "maintenance" } },
    { msg: "Simulated: Import parse error on row 47", tags: { module: "import" } },
    { msg: "Simulated: Email delivery failed for collection notice", tags: { module: "email" } },
  ];

  const messages = [
    { msg: "Warning: Collection score below threshold for unit 4B", level: "warning" },
    { msg: "Warning: Violation cure date approaching in 3 days", level: "warning" },
    { msg: "Info: Cron job collections-refresh completed in 4.2s", level: "info" },
    { msg: "Warning: 3 tenants with stale balance data detected", level: "warning" },
  ];

  // Fire 1-2 exceptions
  const numExceptions = Math.random() > 0.5 ? 2 : 1;
  for (let i = 0; i < numExceptions; i++) {
    const ex = pick(exceptions);
    const error = new Error(ex.msg);
    Sentry.captureException(error, { tags: ex.tags });
    log("🔴", ex.msg);
  }

  // Fire 1 message
  const m = pick(messages);
  Sentry.captureMessage(m.msg, m.level);
  log("💬", `${m.level}: ${m.msg}`);
}

// ── Scenario 4: Performance transactions ───────────────────────
async function firePerformanceTransactions() {
  const operations = [
    { name: "load-test.vacancy-pipeline-check", op: "task", durationMs: 150 },
    { name: "load-test.balance-recalculation", op: "task", durationMs: 300 },
    { name: "load-test.violation-sync-batch", op: "task", durationMs: 500 },
    { name: "load-test.signal-engine-run", op: "task", durationMs: 250 },
    { name: "load-test.collection-stage-advance", op: "task", durationMs: 100 },
  ];

  const txn = pick(operations);
  await Sentry.startSpan({ name: txn.name, op: txn.op }, async (span) => {
    // Simulate child spans
    await Sentry.startSpan({ name: `${txn.name}.db-query`, op: "db.query" }, async () => {
      await sleep(Math.floor(txn.durationMs * 0.6));
    });
    await Sentry.startSpan({ name: `${txn.name}.process`, op: "function" }, async () => {
      await sleep(Math.floor(txn.durationMs * 0.4));
    });
    log("📊", `Transaction: ${txn.name} (~${txn.durationMs}ms)`);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main cycle ─────────────────────────────────────────────────
async function runCycle(cycleNum) {
  console.log(`\n── Cycle ${cycleNum} ──────────────────────────────────`);

  await fireSuccessfulCalls();
  await fireExpectedErrors();
  fireSimulatedErrors();
  await firePerformanceTransactions();

  // Flush to ensure all events are sent
  await Sentry.flush(5000);
  console.log(`── Cycle ${cycleNum} complete, events flushed ──\n`);
}

// ── Entry point ────────────────────────────────────────────────
console.log("🚀 Sentry Load Test");
console.log(`   DSN: ${DSN.slice(0, 30)}...`);
console.log(`   APP: ${APP_URL}`);
console.log(`   Mode: ${ONCE ? "single run" : "continuous (30s interval)"}`);

await runCycle(1);

if (!ONCE) {
  let cycle = 2;
  setInterval(async () => {
    await runCycle(cycle++);
  }, 30_000);
}
