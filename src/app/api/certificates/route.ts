import { NextRequest, NextResponse } from "next/server";
import { sendCertificateViaBrevo } from "@/lib/brevo";
import {
  hasEmailBeenSent,
  getCertificateEmailStatus,
  recordEmailSent,
} from "@/lib/email-tracker";
import {
  getCertificateByIdOrEmail,
  getAllCertificates,
  recordEmailSentInDB,
} from "@/lib/certificates-service";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || searchParams.get("query") || "";
  const listAll = searchParams.get("all") === "true";

  // Return preview list if requested
  if (listAll) {
    const { certificates, stats } = await getAllCertificates();
    const participants = certificates
      .filter((c) => c.type === "participant" || c.id.startsWith("PAR") || c.id.startsWith("CLI"))
      .slice(0, 3);
    const volunteers = certificates
      .filter((c) => c.type === "volunteer" || c.id.startsWith("VOL"))
      .slice(0, 3);
    const demoItems = [...participants, ...volunteers].map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      type: c.type || (c.id.startsWith("VOL") ? "volunteer" : "participant"),
    }));

    return NextResponse.json(
      {
        success: true,
        total: stats.total,
        demoItems,
      },
      { headers: NO_CACHE_HEADERS }
    );
  }

  const query = q.trim();

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        message: "Please enter your registered Email Address or Unique ID to search.",
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Lookup from Supabase PostgreSQL (with fallback to local)
  const match = await getCertificateByIdOrEmail(query);

  if (!match) {
    return NextResponse.json(
      {
        success: false,
        message: `No certificate record found for "${query}". Please verify your credentials or check your orientation confirmation email.`,
      },
      { status: 404, headers: NO_CACHE_HEADERS }
    );
  }

  const certType: "participant" | "volunteer" =
    match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

  // Check if email has already been sent to this user. User can trigger only ONCE!
  const alreadySent = Boolean(match.emailSent) || hasEmailBeenSent(match.id, match.email);
  let emailDeliveryResult: any = { sent: false, skipped: true };

  if (alreadySent) {
    const status = getCertificateEmailStatus(match.id, match.email);
    emailDeliveryResult = {
      sent: false,
      alreadySent: true,
      sentAt: match.emailSentAt || status.sentAt,
      message: "Certificate was previously emailed to your address. Contact the club administrator if you require a resend.",
    };
  } else {
    try {
      emailDeliveryResult = await sendCertificateViaBrevo({
        recipientName: match.name,
        recipientEmail: match.email,
        certificateId: match.id,
        certificateType: certType,
        filename: match.filename,
        appUrl: request.nextUrl.origin,
      });

      if (emailDeliveryResult.sent) {
        recordEmailSent(match.id, match.email, "user", emailDeliveryResult.messageId);
        await recordEmailSentInDB(match.id, match.email, "user");
      }
    } catch (emailErr: any) {
      console.error("Brevo email send error in lookup:", emailErr);
      emailDeliveryResult = { sent: false, error: emailErr.message || "Failed to send email" };
    }
  }

  return NextResponse.json(
    {
      success: true,
      certificate: match,
      id: match.id,
      name: match.name,
      email: match.email,
      type: certType,
      fileUrl: match.fileUrl || match.certificateUrl || `/certificates/${match.id}.png`,
      emailDelivery: emailDeliveryResult,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const q = String(body?.q || body?.query || body?.id || body?.email || "").trim();

    if (!q) {
      return NextResponse.json(
        {
          success: false,
          message: "Search query 'q' is required.",
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const match = await getCertificateByIdOrEmail(q);

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message: `No certificate record found for "${q}".`,
        },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const certType: "participant" | "volunteer" =
      match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

    // Check if email has already been sent
    const alreadySent = Boolean(match.emailSent) || hasEmailBeenSent(match.id, match.email);
    let emailDeliveryResult: any = { sent: false, skipped: true };

    if (alreadySent) {
      const status = getCertificateEmailStatus(match.id, match.email);
      emailDeliveryResult = {
        sent: false,
        alreadySent: true,
        sentAt: match.emailSentAt || status.sentAt,
        message: "Certificate was previously emailed to your address. Contact the administrator if you require a resend.",
      };
    } else {
      try {
        emailDeliveryResult = await sendCertificateViaBrevo({
          recipientName: match.name,
          recipientEmail: match.email,
          certificateId: match.id,
          certificateType: certType,
          filename: match.filename,
          appUrl: request.nextUrl.origin,
        });

        if (emailDeliveryResult.sent) {
          recordEmailSent(match.id, match.email, "user", emailDeliveryResult.messageId);
          await recordEmailSentInDB(match.id, match.email, "user");
        }
      } catch (emailErr: any) {
        console.error("Brevo email send error in POST lookup:", emailErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        certificate: match,
        id: match.id,
        name: match.name,
        email: match.email,
        type: certType,
        fileUrl: match.fileUrl || match.certificateUrl || `/certificates/${match.id}.png`,
        emailDelivery: emailDeliveryResult,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
