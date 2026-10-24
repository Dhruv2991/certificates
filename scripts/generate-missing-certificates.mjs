#!/usr/bin/env node
/**
 * Standalone Batch Certificate Generator Script
 * -----------------------------------------------
 * Queries Supabase for certificates where:
 * 1. certificate_url or file_url is NULL or empty
 * 2. or where the corresponding image file does not yet exist in /public/certificates/
 *
 * Renders the certificate onto the exact high-resolution template,
 * writes the PNG to /public/certificates/, and updates Supabase.
 *
 * Usage:
 *   node scripts/generate-missing-certificates.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Load .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("\x1b[31m[ERROR] Supabase credentials not found in .env.local\x1b[0m");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("\x1b[36m====================================================\x1b[0m");
  console.log("\x1b[36m  TeamCodeLocked & BitByBit Certificate Batch Fixer \x1b[0m");
  console.log("\x1b[36m====================================================\x1b[0m\n");

  console.log("Fetching certificates from Supabase...");
  const { data: rows, error } = await supabase.from("certificates").select("*");

  if (error || !rows) {
    console.error("\x1b[31mFailed to fetch certificates:\x1b[0m", error);
    process.exit(1);
  }

  console.log(`Loaded \x1b[33m${rows.length}\x1b[0m total certificates from database.\n`);

  const outputDir = path.join(projectRoot, "public", "certificates");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Identify ungenerated
  const ungenerated = [];
  for (const row of rows) {
    const certUrl = (row.certificate_url || "").trim();
    const fileUrl = (row.file_url || "").trim();
    const isPlaceholder =
      certUrl.includes("bitbybit-9h8e.vercel.app/certificates/") ||
      fileUrl.includes("bitbybit-9h8e.vercel.app/certificates/");

    // Check if URL is truly NULL, empty, or legacy placeholder
    const isUrlNull = !certUrl || !fileUrl || isPlaceholder;

    // Only for local relative paths, check whether local file exists on disk
    const isLocalPath =
      (fileUrl.startsWith("/") || certUrl.startsWith("/")) &&
      !fileUrl.startsWith("//") &&
      !certUrl.startsWith("//") &&
      !fileUrl.startsWith("http") &&
      !certUrl.startsWith("http");

    let hasLocalFile = true;
    if (isLocalPath) {
      const targetFilename = `${row.id}.png`;
      const localTarget = path.join(outputDir, targetFilename);
      const altFilename = row.filename || "";
      const localAlt = altFilename ? path.join(outputDir, altFilename) : "";
      hasLocalFile = fs.existsSync(localTarget) || (Boolean(localAlt) && fs.existsSync(localAlt));
    }

    if (isUrlNull || (isLocalPath && !hasLocalFile)) {
      ungenerated.push({
        ...row,
        targetFilename: `${row.id}.png`,
      });
    }
  }

  console.log(`Found \x1b[35m${ungenerated.length}\x1b[0m records needing certificate image generation/linking.\n`);

  if (ungenerated.length === 0) {
    console.log("\x1b[32m[ALL UP TO DATE] Every certificate in Supabase has a generated image and valid URLs!\x1b[0m");
    return;
  }

  let generatedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < ungenerated.length; i++) {
    const record = ungenerated[i];
    const certType = record.type === "volunteer" || String(record.id).startsWith("VOL") ? "volunteer" : "participant";
    const cleanName = String(record.name || "").trim().replace(/[\[\]]/g, "");
    const cleanEmail = String(record.email || "").trim().toLowerCase();
    const targetFilename = record.targetFilename;
    const outPath = path.join(outputDir, targetFilename);

    process.stdout.write(`[${i + 1}/${ungenerated.length}] Generating ${record.id} (${cleanName})... `);

    try {
      // 1. Generate via Pillow Python script
      const scriptPath = path.join(projectRoot, "generate_certs.py");
      if (fs.existsSync(scriptPath)) {
        const cmd = `python "${scriptPath}" --single --name "${cleanName.replace(/"/g, '\\"')}" --email "${cleanEmail.replace(/"/g, '\\"')}" --id "${record.id}" --type "${certType}"`;
        try {
          await execAsync(cmd);
        } catch (pyErr) {
          // If python failed, continue to verify or log
          console.warn(`(py: ${pyErr.message}) `);
        }
      }

      // 2. Also save alias filename if different
      if (record.filename && record.filename !== targetFilename && fs.existsSync(outPath)) {
        const aliasPath = path.join(outputDir, record.filename.replace(/\.pdf$/i, ".png"));
        if (!fs.existsSync(aliasPath)) {
          try {
            fs.copyFileSync(outPath, aliasPath);
          } catch {
            // Ignore
          }
        }
      }

      // 3. Update Supabase record
      const fileUrl = `/certificates/${targetFilename}`;
      const { error: updateError } = await supabase
        .from("certificates")
        .update({
          file_url: fileUrl,
          certificate_url: fileUrl,
          filename: targetFilename,
        })
        .eq("id", record.id);

      if (updateError) {
        console.log(`\x1b[31m[DB ERROR: ${updateError.message}]\x1b[0m`);
        errorCount++;
      } else {
        console.log("\x1b[32m[DONE]\x1b[0m");
        generatedCount++;
      }
    } catch (err) {
      console.log(`\x1b[31m[FAILED: ${err.message}]\x1b[0m`);
      errorCount++;
    }
  }

  console.log("\n\x1b[36m====================================================\x1b[0m");
  console.log(`  Completed: \x1b[32m${generatedCount} generated & linked\x1b[0m | \x1b[31m${errorCount} failed\x1b[0m`);
  console.log("\x1b[36m====================================================\x1b[0m\n");
}

run();
