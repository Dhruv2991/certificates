import { NextRequest, NextResponse } from "next/server";

export const ADMIN_EMAIL = "dhruvg.cs24@bmsce.ac.in";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "codelocked2026";
export const SESSION_COOKIE_NAME = "admin_session";

// Simple secure session token representation
export function isValidAdminSession(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const headerEmail = request.headers.get("x-admin-email");
  const authHeader = request.headers.get("authorization");

  if (cookie && cookie.includes(ADMIN_EMAIL)) {
    return true;
  }
  if (headerEmail && headerEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  if (authHeader && authHeader.includes("Bearer") && authHeader.includes(ADMIN_EMAIL)) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const authenticated = isValidAdminSession(request);
  if (!authenticated) {
    return NextResponse.json(
      { success: false, authenticated: false, message: "Not authenticated" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: {
      email: ADMIN_EMAIL,
      role: "Head of BitByBit & Admin",
      name: "Dhruv G Nayak",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    // Verify restricted email
    if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          message: `Access denied. Administration is strictly restricted to ${ADMIN_EMAIL}.`,
        },
        { status: 403 }
      );
    }

    // Verify password
    if (cleanPassword !== ADMIN_PASSWORD) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect administrator password.",
        },
        { status: 401 }
      );
    }

    // Valid admin login
    const sessionToken = `token_${Buffer.from(ADMIN_EMAIL + ":" + Date.now()).toString("base64")}`;

    const response = NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      admin: {
        email: ADMIN_EMAIL,
        name: "Dhruv G Nayak",
        role: "Head of BitByBit",
      },
      token: sessionToken,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: `${ADMIN_EMAIL}_${sessionToken}`,
      httpOnly: false, // Accessible to client-side JS for simple auth state management
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Admin logged out successfully",
  });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
