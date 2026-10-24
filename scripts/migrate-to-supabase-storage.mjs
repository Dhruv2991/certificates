#!/usr/bin/env node
/**
 * Standalone Supabase Storage Batch Migration Script (HTTP Client)
 * -----------------------------------------------------------------
 * Triggers batch certificate generation and Supabase Storage migration
 * via HTTP fetch to the Next.js API route.
 *
 * This completely avoids `next/og` module resolution crashes in pure Node CLI
 * environments by delegating rendering and storage operations directly to the
 * running Next.js server environment.
 *
 * Usage:
 *   node scripts/migrate-to-supabase-storage.mjs [--all] [--bucket certificates] [--url http://localhost:3000]
 *   npm run migrate:storage -- --all
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Load environment variables from .env.local
const envPath = path.join(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// 2. Parse Command-Line Arguments
const args = process.argv.slice(2);
const migrateAll = args.includes("--all");
const onlyMissing = !migrateAll;

const bucketIdx = args.indexOf("--bucket");
const bucketName = bucketIdx !== -1 && args[bucketIdx + 1] ? args[bucketIdx + 1] : "certificates";

const urlIdx = args.indexOf("--url");
let targetBaseUrl =
  urlIdx !== -1 && args[urlIdx + 1]
    ? args[urlIdx + 1]
    : process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Ensure clean URL without trailing slash
targetBaseUrl = targetBaseUrl.replace(/\/+$/, "");
const endpointUrl = `${targetBaseUrl}/api/admin/certificates/storage-migration`;

const passIdx = args.indexOf("--password");
const adminPassword =
  passIdx !== -1 && args[passIdx + 1]
    ? args[passIdx + 1]
    : process.env.ADMIN_PASSWORD || "Dhruv@2006";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("\x1b[36m========================================================\x1b[0m");
console.log("\x1b[36m  TeamCodeLocked & BitByBit Storage Migration Trigger   \x1b[0m");
console.log("\x1b[36m========================================================\x1b[0m\n");
console.log(`Server Endpoint: \x1b[34m${endpointUrl}\x1b[0m`);
console.log(`Storage Bucket:  \x1b[33m${bucketName}\x1b[0m`);
console.log(`Migration Mode:  \x1b[35m${migrateAll ? "ALL Records (--all, onlyMissing: false)" : "Missing / Unlinked Records Only (onlyMissing: true)"}\x1b[0m\n`);

async function run() {
  const payload = {
    onlyMissing,
    bucketName,
    adminPassword,
    password: adminPassword,
  };

  const headers = {
    "Content-Type": "application/json",
    "x-admin-password": adminPassword,
    Authorization: `Bearer ${serviceRoleKey || adminPassword}`,
  };

  if (serviceRoleKey) {
    headers["x-service-role-key"] = serviceRoleKey;
    headers["apikey"] = serviceRoleKey;
  }

  process.stdout.write("Sending batch migration request to server... ");

  let response;
  try {
    response = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    console.log("\x1b[31m[FAILED TO CONNECT]\x1b[0m\n");
    console.error(`\x1b[31mConnection error: ${netErr.message}\x1b[0m`);
    console.log("\n\x1b[33mTroubleshooting:\x1b[0m");
    console.log(`1. Make sure your local Next.js server is running: \x1b[32mnpm run dev\x1b[0m`);
    console.log(`2. Or target a remote/production server: \x1b[32mnpm run migrate:storage -- --url https://your-app.vercel.app\x1b[0m\n`);
    process.exit(1);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const rawText = await response.text().catch(() => "");
    console.log(`\x1b[31m[INVALID JSON RESPONSE (${response.status})]\x1b[0m\n`);
    console.error(rawText.slice(0, 500));
    process.exit(1);
  }

  if (!response.ok || !data.success) {
    console.log(`\x1b[31m[FAILED (HTTP ${response.status})]\x1b[0m\n`);
    console.error(`\x1b[31mServer Error:\x1b[0m ${data?.message || response.statusText}`);
    if (data?.results?.length) {
      const failures = data.results.filter((r) => !r.success);
      console.log(`Failed items: ${failures.length}`);
      failures.slice(0, 5).forEach((f) => console.log(` - ${f.id} (${f.name}): ${f.error || "Unknown error"}`));
    }
    process.exit(1);
  }

  console.log(`\x1b[32m[SUCCESS (HTTP ${response.status})]\x1b[0m\n`);
  console.log("\x1b[32m" + (data.message || "Batch migration completed successfully!") + "\x1b[0m");
  console.log("--------------------------------------------------------");
  console.log(`Total scanned in database: \x1b[33m${data.totalScanned ?? "N/A"}\x1b[0m`);
  console.log(`Total processed:           \x1b[36m${data.processedCount ?? "N/A"}\x1b[0m`);
  console.log(`Successfully migrated:     \x1b[32m${data.successCount ?? 0}\x1b[0m`);
  console.log(`Failed:                    \x1b[${data.failedCount > 0 ? "31" : "32"}m${data.failedCount ?? 0}\x1b[0m`);
  console.log("--------------------------------------------------------\n");

  if (data.results && data.results.length > 0) {
    const sample = data.results.slice(0, 5);
    console.log("Sample Updated Records:");
    sample.forEach((item) => {
      console.log(`  ✓ \x1b[1m${item.id}\x1b[0m: ${item.name} -> \x1b[34m${item.url}\x1b[0m`);
    });
    if (data.results.length > 5) {
      console.log(`  ... and ${data.results.length - 5} more records.`);
    }
    console.log("");
  }
}

run().catch((err) => {
  console.error("\x1b[31mUnexpected migration CLI error:\x1b[0m", err);
  process.exit(1);
});
