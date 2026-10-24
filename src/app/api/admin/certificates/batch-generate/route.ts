import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession, checkAdminPassword, ADMIN_EMAIL } from "../../auth/route";
import {
  getMissingCertificates,
  batchGenerateMissingCertificates,
} from "@/lib/certificates-service";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/admin/certificates/batch-generate
 * Returns the count and list of certificates needing generation.
 */
export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const { count, missing } = await getMissingCertificates();
    return NextResponse.json(
      {
        success: true,
        missingCount: count,
        missingCertificates: missing.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          type: m.type,
          fileUrl: m.fileUrl,
          certificateUrl: m.certificateUrl,
        })),
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error("Error checking missing certificates:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to inspect missing certificates." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * POST /api/admin/certificates/batch-generate
 * Triggers batch generation for all ungenerated certificates.
 */
export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Optional body
  }

  const suppliedPassword = body?.password || body?.adminPassword;
  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isDirectPasswordValid && !isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const result = await batchGenerateMissingCertificates();

    return NextResponse.json(
      {
        success: true,
        message: `Generated ${result.generatedCount} of ${result.totalMissing} missing certificates.`,
        ...result,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error("Error in batch certificate generation:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to batch generate certificates." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
