import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword, isValidAdminSession } from "../admin/auth/route";
import {
  getCertificateByIdOrEmail,
  recordEmailSentInDB,
} from "@/lib/certificates-service";
import { sendCertificateViaBrevo } from "@/lib/brevo";
import { hasEmailBeenSent, recordEmailSent } from "@/lib/email-tracker";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * POST /api/send-email
 * Unified email dispatch route:
 * - Admin (with password Dhruv@2006 or session): allows multiple dispatches, updates Supabase email_count & last_sent_by: 'admin'.
 * - Regular user: single-dispatch limit, checks Supabase email_sent / email_count and gracefully blocks duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, password, adminPassword } = body || {};

    const query = String(id || email || "").trim();
    if (!query) {
      return NextResponse.json(
        { success: false, message: "Certificate 'id' or 'email' is required." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const match = await getCertificateByIdOrEmail(query);
    if (!match) {
      return NextResponse.json(
        { success: false, message: `Certificate '${query}' not found in registry.` },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const recipientEmail = (email || match.email || "").trim();
    if (!recipientEmail) {
      return NextResponse.json(
        { success: false, message: "No recipient email available for this certificate." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const certType: "participant" | "volunteer" =
      match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

    const suppliedPassword = password || adminPassword;
    const isAdmin =
      (suppliedPassword && checkAdminPassword(suppliedPassword)) ||
      isValidAdminSession(request);

    // If regular user: check single-dispatch limit
    if (!isAdmin) {
      const alreadySent =
        Boolean(match.emailSent) ||
        Boolean(match.emailCount && match.emailCount > 0) ||
        (await hasEmailBeenSent(match.id, recipientEmail));

      if (alreadySent) {
        return NextResponse.json(
          {
            success: false,
            alreadySent: true,
            sentAt: match.emailSentAt,
            message:
              "Certificate was previously emailed to your address. Contact the club administrator if you require a resend.",
          },
          { status: 200, headers: NO_CACHE_HEADERS }
        );
      }
    }

    // Dispatch via Brevo API
    const sendResult = await sendCertificateViaBrevo({
      recipientName: match.name,
      recipientEmail,
      certificateId: match.id,
      certificateType: certType,
      filename: match.filename,
      appUrl: request.nextUrl.origin,
    });

    if (sendResult.sent) {
      const triggeredBy = isAdmin ? "admin" : "user";
      const dbResult = await recordEmailSentInDB(match.id, recipientEmail, triggeredBy);
      await recordEmailSent(match.id, recipientEmail, triggeredBy, sendResult.messageId);

      return NextResponse.json(
        {
          success: true,
          message: `Certificate email successfully dispatched to ${recipientEmail}.`,
          messageId: sendResult.messageId,
          sentAt: dbResult.sentAt,
          emailCount: dbResult.count,
          lastSentBy: triggeredBy,
        },
        { headers: NO_CACHE_HEADERS }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: sendResult.error || "Failed to dispatch email via Brevo.",
        },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }
  } catch (err: any) {
    console.error("Error in /api/send-email:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Internal server error." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
