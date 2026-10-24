#!/usr/bin/env node
/**
 * Standalone Supabase Storage Batch Migration Script
 * ----------------------------------------------------
 * 1. Leverages existing certificate generator in-memory (zero local disk writes, EROFS safe).
 * 2. Fetches participant and volunteer records from Supabase.
 * 3. Uploads file buffers directly to Supabase Storage bucket ('certificates').
 * 4. Obtains public URL via getPublicUrl.
 * 5. Updates Supabase 'certificates' table rows with new certificate_url, file_url, and filename.
 *
 * Usage:
 *   node scripts/migrate-to-supabase-storage.mjs [--all] [--bucket certificates]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import React from "react";

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

// Template Base64 cache
let participantTemplateBase64 = null;
let volunteerTemplateBase64 = null;

function getTemplateBase64(type) {
  const isVol = type === "volunteer";
  if (isVol && volunteerTemplateBase64) return volunteerTemplateBase64;
  if (!isVol && participantTemplateBase64) return participantTemplateBase64;

  const candidateNames = isVol
    ? ["template_volunteer.png", "Volunteer 2.png"]
    : ["template_participant.png", "2.png"];

  for (const name of candidateNames) {
    const candidatePath = path.join(projectRoot, name);
    if (fs.existsSync(candidatePath)) {
      try {
        const buf = fs.readFileSync(candidatePath);
        const b64 = `data:image/png;base64,${buf.toString("base64")}`;
        if (isVol) volunteerTemplateBase64 = b64;
        else participantTemplateBase64 = b64;
        return b64;
      } catch (err) {
        console.error(`Error reading template ${name}:`, err);
      }
    }
  }

  throw new Error(`Certificate template for ${type} not found.`);
}

/**
 * Pure in-memory certificate generator (zero disk writes, EROFS safe).
 */
async function generateCertificateBuffer({ name, type }) {
  const cleanName = String(name || "").trim().replace(/[\[\]]/g, "") || "Participant";
  const templateBase64 = getTemplateBase64(type);

  const element = React.createElement(
    "div",
    {
      style: {
        position: "relative",
        width: 1024,
        height: 723,
        display: "flex",
      },
    },
    [
      React.createElement("img", {
        key: "bg",
        src: templateBase64,
        alt: "Template",
        width: 1024,
        height: 723,
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: 1024,
          height: 723,
        },
      }),
      React.createElement("div", {
        key: "mask",
        style: {
          position: "absolute",
          top: 368,
          left: 122,
          width: 774,
          height: 76,
          backgroundColor: "#ffffff",
        },
      }),
      React.createElement(
        "div",
        {
          key: "name",
          style: {
            position: "absolute",
            top: 380,
            left: 134,
            fontSize: 46,
            fontWeight: 700,
            color: "#111827",
            fontFamily: "sans-serif",
            letterSpacing: "-0.5px",
          },
        },
        cleanName
      ),
    ]
  );

  const res = new ImageResponse(element, { width: 1024, height: 723 });
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function run() {
  const args = process.argv.slice(2);
  const migrateAll = args.includes("--all");
  const bucketIdx = args.indexOf("--bucket");
  const bucketName = bucketIdx !== -1 && args[bucketIdx + 1] ? args[bucketIdx + 1] : "certificates";

  console.log("\x1b[36m========================================================\x1b[0m");
  console.log("\x1b[36m  TeamCodeLocked & BitByBit Supabase Storage Migrator  \x1b[0m");
  console.log("\x1b[36m========================================================\x1b[0m\n");
  console.log(`Target Storage Bucket: \x1b[33m${bucketName}\x1b[0m`);
  console.log(`Mode: \x1b[33m${migrateAll ? "All Records" : "Unlinked / Missing URLs Only"}\x1b[0m\n`);

  // Ensure bucket exists or create it
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some((b) => b.name === bucketName);
    if (!hasBucket) {
      console.log(`Bucket '${bucketName}' not found. Attempting to create public bucket...`);
      const { error: bCreateError } = await supabase.storage.createBucket(bucketName, { public: true });
      if (bCreateError) {
        console.warn(`\x1b[33m[NOTICE] Bucket create: ${bCreateError.message}\x1b[0m`);
        console.log(`(If needed, create public bucket '${bucketName}' in Supabase Dashboard -> Storage)\n`);
      } else {
        console.log(`\x1b[32mBucket '${bucketName}' successfully created!\x1b[0m\n`);
      }
    } else {
      console.log(`\x1b[32mVerified storage bucket '${bucketName}' exists.\x1b[0m\n`);
    }
  } catch (bErr) {
    console.warn("[NOTICE] Checking storage buckets:", bErr.message);
  }

  // Fetch records
  console.log("Fetching records from Supabase `certificates` table...");
  const { data: rows, error: fetchErr } = await supabase.from("certificates").select("*");

  if (fetchErr || !rows) {
    console.error("\x1b[31mError fetching certificates:\x1b[0m", fetchErr);
    process.exit(1);
  }

  console.log(`Total database records: \x1b[33m${rows.length}\x1b[0m`);

  // Filter if not --all
  const targetRecords = migrateAll
    ? rows
    : rows.filter((r) => !r.certificate_url || !r.file_url || r.file_url.includes("bitbybit-9h8e.vercel.app"));

  console.log(`Records to process: \x1b[35m${targetRecords.length}\x1b[0m\n`);

  if (targetRecords.length === 0) {
    console.log("\x1b[32m[ALL LINKED] All records already have valid URLs! Use --all to re-upload all records.\x1b[0m");
    return;
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < targetRecords.length; i++) {
    const record = targetRecords[i];
    const certType = record.type === "volunteer" || String(record.id).startsWith("VOL") ? "volunteer" : "participant";
    const filename = `${record.id}.png`;

    process.stdout.write(`[${i + 1}/${targetRecords.length}] Generating buffer for ${record.id} (${record.name})... `);

    try {
      // 1. Generate buffer directly in memory (zero local disk writes)
      const buffer = await generateCertificateBuffer({
        name: record.name,
        type: certType,
      });

      // 2. Upload directly to Supabase Storage bucket
      let publicUrl = `/certificates/${filename}`;
      const { error: uploadErr } = await supabase.storage
        .from(bucketName)
        .upload(filename, buffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
        if (urlData?.publicUrl) {
          publicUrl = urlData.publicUrl;
        }
        process.stdout.write(`Uploaded -> `);
      } else {
        process.stdout.write(`[Storage notice: ${uploadErr.message}] -> `);
      }

      // 3. Update Supabase table row
      const { error: dbErr } = await supabase
        .from("certificates")
        .update({
          certificate_url: publicUrl,
          file_url: publicUrl,
          filename: filename,
        })
        .eq("id", record.id);

      if (dbErr) {
        console.log(`\x1b[31m[DB Error: ${dbErr.message}]\x1b[0m`);
        failedCount++;
      } else {
        console.log(`\x1b[32m[DONE]\x1b[0m (${publicUrl})`);
        successCount++;
      }
    } catch (err) {
      console.log(`\x1b[31m[FAILED: ${err.message}]\x1b[0m`);
      failedCount++;
    }
  }

  console.log("\n\x1b[36m========================================================\x1b[0m");
  console.log(`  Completed: \x1b[32m${successCount} processed & updated\x1b[0m | \x1b[31m${failedCount} failed\x1b[0m`);
  console.log("\x1b[36m========================================================\x1b[0m\n");
}

run().catch((e) => {
  console.error("Migration script failed:", e);
  process.exit(1);
});
