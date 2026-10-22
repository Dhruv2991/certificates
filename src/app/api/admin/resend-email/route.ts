import { NextRequest, NextResponse } from "next/server";
import { isValidAdminSession, ADMIN_EMAIL } from "../auth/route";
import { adminResendCertificateEmail } from "@/lib/email-tracker";

export async function POST(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      {
        success: false,
        message: `Unauthorized. Admin access restricted strictly to ${ADMIN_EMAIL}.`,
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, email } = body || {};

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Certificate 'id' is required." },
        { status: 400 }
      );
    }

    const appUrl = request.nextUrl.origin;
    const result = await adminResendCertificateEmail(id, email, appUrl);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        messageId: result.messageId,
        sentAt: result.sentAt,
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
