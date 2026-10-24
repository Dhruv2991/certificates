import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession, checkAdminPassword, ADMIN_EMAIL } from "../auth/route";
import { adminResendCertificateEmail } from "@/lib/email-tracker";

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }

  const { id, email, password, adminPassword } = body || {};
  const suppliedPassword = password || adminPassword;

  // Verify authentication via session or direct password check
  const isDirectPasswordValid = suppliedPassword && checkAdminPassword(suppliedPassword);

  if (!isDirectPasswordValid && !isValidAdminSession(request)) {
    return NextResponse.json(
      {
        success: false,
        message: `Unauthorized. Admin access restricted strictly to ${ADMIN_EMAIL}.`,
      },
      { status: 401 }
    );
  }

  if (!id) {
    return NextResponse.json(
      { success: false, message: "Certificate 'id' is required." },
      { status: 400 }
    );
  }

  try {
    const appUrl = request.nextUrl.origin;
    const result = await adminResendCertificateEmail(id, email, appUrl);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        messageId: result.messageId,
        sentAt: result.sentAt,
        emailCount: result.emailCount,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Error in admin resend email route:", err);
    return NextResponse.json(
      { success: false, message: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
