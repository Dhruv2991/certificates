import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { isValidAdminSession, checkAdminPassword, ADMIN_EMAIL } from "../auth/route";
import {
  getAllCertificates,
  getCertificateByIdOrEmail,
  getNextCertificateId,
  createCertificateRecord,
  deleteCertificateRecord,
} from "@/lib/certificates-service";
import { AppCertificateRecord } from "@/lib/supabase";

const execAsync = promisify(exec);

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

// GET: Retrieve all certificates with optional filtering, search & stats
export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type"); // 'participant' | 'volunteer' | null
  const searchFilter = (searchParams.get("q") || "").trim();
  const sortParam = (searchParams.get("sort") || "newest") as "newest" | "oldest";

  const result = await getAllCertificates({
    typeFilter: typeFilter === "participant" || typeFilter === "volunteer" ? typeFilter : null,
    searchFilter,
    sortOrder: sortParam === "oldest" ? "oldest" : "newest",
  });

  return NextResponse.json(
    {
      success: true,
      stats: result.stats,
      certificates: result.certificates,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

// POST: Add a new certificate record, render its PNG image, and persist permanently to Supabase
export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON payload." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const suppliedPassword = body?.password || body?.adminPassword;
  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isDirectPasswordValid && !isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required with password (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const { name, email, type } = body;

    const cleanName = String(name || "").trim().replace(/[\[\]]/g, "");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const certType: "participant" | "volunteer" = type === "volunteer" ? "volunteer" : "participant";

    if (!cleanName || !cleanEmail) {
      return NextResponse.json(
        { success: false, message: "Name and email are required fields." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // Check duplicate in database
    const existing = await getCertificateByIdOrEmail(cleanEmail);
    if (existing && existing.type === certType) {
      return NextResponse.json(
        {
          success: false,
          message: `A ${certType} certificate already exists for ${cleanEmail} (ID: ${existing.id}).`,
        },
        { status: 409, headers: NO_CACHE_HEADERS }
      );
    }

    // Check for optional custom ID (e.g. when re-issuing a deleted certificate) or calculate next sequential ID
    const customId = body?.id ? String(body.id).trim().toUpperCase() : "";
    const nextId = customId || (await getNextCertificateId(certType));
    const filename = `${nextId}.png`;
    const fileUrl = `/certificates/${filename}`;

    const newRecord: AppCertificateRecord = {
      id: nextId,
      name: cleanName,
      email: cleanEmail,
      type: certType,
      fileUrl: fileUrl,
      certificateUrl: fileUrl,
      filename: filename,
      organization: "TeamCodeLocked",
      college: "B.M.S. College of Engineering",
      event: "Club Orientation 2026",
      partner: "BitByBit",
      partnerUrl: "https://bitbybit-9h8e.vercel.app",
      emailSent: false,
      emailCount: 0,
    };

    // Dynamically render certificate image into public folder if environment is writable
    if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
      try {
        const { renderCertificatePngBuffer } = await import("@/lib/certificate-renderer");
        const pngBuf = await renderCertificatePngBuffer({
          name: cleanName,
          type: certType,
          id: nextId,
        });
        const outDir = path.join(process.cwd(), "public", "certificates");
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(path.join(outDir, filename), pngBuf);
      } catch (nodeGenErr) {
        console.warn("Node certificate render warning:", nodeGenErr);
      }

      // Also invoke Python Pillow script if available to sync local spreadsheets
      try {
        const scriptPath = path.join(process.cwd(), "generate_certs.py");
        if (fs.existsSync(/* turbopackIgnore: true */ scriptPath)) {
          const cmd = `python "${scriptPath}" --single --name "${cleanName.replace(/"/g, '\\"')}" --email "${cleanEmail.replace(/"/g, '\\"')}" --id "${nextId}" --type "${certType}"`;
          await execAsync(cmd);
        }
      } catch (genErr) {
        console.warn("Python certificate generation warning:", genErr);
      }
    }

    // Persist permanently to Supabase PostgreSQL
    const saveResult = await createCertificateRecord(newRecord);

    return NextResponse.json(
      {
        success: true,
        message: `${certType === "volunteer" ? "Volunteer" : "Participant"} certificate created for ${cleanName} (${nextId})`,
        certificate: saveResult.certificate,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error("Error creating certificate:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Internal server error creating certificate." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

// DELETE: Remove a certificate record by ID from Supabase
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  let suppliedPassword = searchParams.get("password") || searchParams.get("adminPassword");

  if (!id || !suppliedPassword) {
    try {
      const body = await request.json();
      if (!id) id = body?.id;
      if (!suppliedPassword) suppliedPassword = body?.password || body?.adminPassword;
    } catch {
      // Ignore
    }
  }

  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isDirectPasswordValid && !isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required with password (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  const cleanId = String(id || "").trim();
  if (!cleanId) {
    return NextResponse.json(
      { success: false, message: "Certificate ID is required to delete." },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Delete from Supabase PostgreSQL
  const deleteResult = await deleteCertificateRecord(cleanId);

  if (!deleteResult.success || !deleteResult.deletedRecord) {
    return NextResponse.json(
      { success: false, message: `Certificate '${cleanId}' not found in database.` },
      { status: 404, headers: NO_CACHE_HEADERS }
    );
  }

  // Attempt to delete physical image if present in local writable environment
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const filename = deleteResult.deletedRecord?.filename || `${cleanId}.png`;
      const imgPath = path.join(process.cwd(), "public", "certificates", filename);
      if (fs.existsSync(/* turbopackIgnore: true */ imgPath)) {
        fs.unlinkSync(/* turbopackIgnore: true */ imgPath);
      }
    } catch (e) {
      console.error("Could not delete image file:", e);
    }
  }

  return NextResponse.json(
    {
      success: true,
      message: `Certificate ${cleanId} has been deleted permanently.`,
      deletedId: cleanId,
    },
    { headers: NO_CACHE_HEADERS }
  );
}
