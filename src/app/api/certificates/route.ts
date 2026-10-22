import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sendCertificateViaBrevo } from "@/lib/brevo";
import {
  hasEmailBeenSent,
  getCertificateEmailStatus,
  recordEmailSent,
} from "@/lib/email-tracker";

export interface CertificateRecord {
  id: string;
  name: string;
  email: string;
  type?: "participant" | "volunteer";
  fileUrl: string;
  certificateUrl?: string;
  filename?: string;
  event?: string;
  issueDate?: string;
  organization?: string;
  college?: string;
  partner?: string;
  partnerUrl?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailCount?: number;
}

function loadCertificates(): CertificateRecord[] {
  const candidatePaths = [
    path.join(process.cwd(), "public", "certificates.json"),
    path.join(process.cwd(), "certificates.json"),
    path.join(process.cwd(), "src", "data", "certificates.json"),
    path.join(process.cwd(), "data", "certificates.json"),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      try {
        const fileContent = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        console.error(`Error parsing certificates from ${filePath}:`, err);
      }
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || searchParams.get("query") || "";
  const listAll = searchParams.get("all") === "true";

  const certificates = loadCertificates();

  // Return demo preview list if requested
  if (listAll) {
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

    return NextResponse.json({
      success: true,
      total: certificates.length,
      demoItems,
    });
  }

  const query = q.trim().toLowerCase();

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        message: "Please enter your registered Email Address or Unique ID to search.",
      },
      { status: 400 }
    );
  }

  // Exact case-insensitive match on email or id
  let match = certificates.find(
    (c) =>
      c.id.toLowerCase() === query ||
      c.email.toLowerCase() === query
  );

  // Alphanumeric fallback if hyphens or spaces were omitted in ID
  if (!match) {
    const cleanQuery = query.replace(/[^a-z0-9]/g, "");
    if (cleanQuery.length >= 3) {
      match = certificates.find((c) => {
        const cleanId = c.id.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanId === cleanQuery;
      });
    }
  }

  if (!match) {
    return NextResponse.json(
      {
        success: false,
        message: `No certificate record found for "${q.trim()}". Please verify your credentials or check your orientation confirmation email.`,
      },
      { status: 404 }
    );
  }

  const certType: "participant" | "volunteer" =
    match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

  // Check if email has already been sent to this user. User can trigger only ONCE!
  const alreadySent = hasEmailBeenSent(match.id, match.email);
  let emailDeliveryResult: any = { sent: false, skipped: true };

  if (alreadySent) {
    const status = getCertificateEmailStatus(match.id, match.email);
    emailDeliveryResult = {
      sent: false,
      alreadySent: true,
      sentAt: status.sentAt || match.emailSentAt,
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
      }
    } catch (emailErr: any) {
      console.error("Brevo email send error in lookup:", emailErr);
      emailDeliveryResult = { sent: false, error: emailErr.message || "Failed to send email" };
    }
  }

  return NextResponse.json({
    success: true,
    certificate: match,
    id: match.id,
    name: match.name,
    email: match.email,
    type: certType,
    fileUrl: match.fileUrl || match.certificateUrl || `/certificates/${match.id}.png`,
    emailDelivery: emailDeliveryResult,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const q = String(body?.q || body?.query || body?.id || body?.email || "").trim().toLowerCase();

    if (!q) {
      return NextResponse.json(
        {
          success: false,
          message: "Search query 'q' is required.",
        },
        { status: 400 }
      );
    }

    const certificates = loadCertificates();
    const match = certificates.find(
      (c) =>
        c.id.toLowerCase() === q ||
        c.email.toLowerCase() === q
    );

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message: `No certificate record found for "${q}".`,
        },
        { status: 404 }
      );
    }

    const certType: "participant" | "volunteer" =
      match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

    // Check if email has already been sent
    const alreadySent = hasEmailBeenSent(match.id, match.email);
    let emailDeliveryResult: any = { sent: false, skipped: true };

    if (alreadySent) {
      const status = getCertificateEmailStatus(match.id, match.email);
      emailDeliveryResult = {
        sent: false,
        alreadySent: true,
        sentAt: status.sentAt || match.emailSentAt,
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
        }
      } catch (emailErr: any) {
        console.error("Brevo email send error in POST lookup:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      certificate: match,
      id: match.id,
      name: match.name,
      email: match.email,
      type: certType,
      fileUrl: match.fileUrl || match.certificateUrl || `/certificates/${match.id}.png`,
      emailDelivery: emailDeliveryResult,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request body.",
      },
      { status: 400 }
    );
  }
}
