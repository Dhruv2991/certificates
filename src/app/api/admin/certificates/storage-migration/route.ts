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

  const suppliedPassword = body?.password || body?.adminPassword;
  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isDirectPasswordValid && !isValidAdminSession(request)) {
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
