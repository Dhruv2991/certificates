import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession, checkAdminPassword, ADMIN_EMAIL } from "../../auth/route";
import { batchMigrateCertificatesToStorage } from "@/lib/certificates-service";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * POST /api/admin/certificates/storage-migration
 * Batch migration API:
 * 1. Generates certificate buffers directly in memory using existing Next.js generator (zero local disk writes, EROFS safe).
 * 2. Uploads buffers directly to Supabase Storage ('certificates' bucket).
 * 3. Retrieves public URLs via getPublicUrl.
 * 4. Updates corresponding rows in Supabase certificates table.
 */
export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Optional body
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const headerPassword = request.headers.get("x-admin-password") || bearerToken;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isServiceRoleValid =
    serviceRoleKey &&
    (bearerToken === serviceRoleKey ||
      request.headers.get("apikey") === serviceRoleKey ||
      request.headers.get("x-service-role-key") === serviceRoleKey);

  const suppliedPassword = body?.password || body?.adminPassword || headerPassword;
  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isServiceRoleValid && !isDirectPasswordValid && !isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401, headers: NO_CACHE_HEADERS }
    );
  }

  try {
    const onlyMissing = body?.onlyMissing === true;
    const bucketName = body?.bucketName?.trim() || "certificates";

    const result = await batchMigrateCertificatesToStorage({
      onlyMissing,
      bucketName,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Migrated ${result.successCount} of ${result.processedCount} certificates to Supabase Storage (${bucketName}).`,
        ...result,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    console.error("Error in storage migration:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Storage migration failed." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
