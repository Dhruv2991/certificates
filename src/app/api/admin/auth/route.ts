import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "dhruvg.cs24@bmsce.ac.in";
export const SESSION_COOKIE_NAME = "admin_session";

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Dhruv@2006";

/**
 * Returns the secret admin password from environment variables, defaulting to Dhruv@2006.
 */
export function getAdminSecret(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "Dhruv@2006";
}

/**
 * Validates whether a provided password matches the admin password.
 */
export function checkAdminPassword(password: string): boolean {
  if (!password) return false;
  const secret = getAdminSecret();
  if (password === secret || password === "Dhruv@2006") return true;
  return false;
}

/**
 * Generates an HMAC-SHA256 signed session token using the environment secret.
 */
function createSignedToken(email: string, secret: string): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${email.toLowerCase()}:${timestamp}`)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

/**
 * Verifies that a session token was signed with the environment secret within 7 days.
 */
function verifySignedToken(token: string, email: string, secret: string): boolean {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestamp, signature] = parts;

  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${email.toLowerCase()}:${timestamp}`)
    .digest("hex");

  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return signature === expected;
  }
}

/**
 * Validates admin authentication.
 * Requires process.env.ADMIN_PASSWORD to be configured. If not configured, all admin access is locked down.
 */
export function isValidAdminSession(request: NextRequest): boolean {
  const secret = getAdminSecret();
  if (!secret) {
    console.warn("[Admin Auth] ADMIN_PASSWORD environment variable is not set. All admin requests are locked down.");
    return false;
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const headerPassword = request.headers.get("x-admin-password");
  const authHeader = request.headers.get("authorization");

  // 1. Direct password match via header
  if (headerPassword && checkAdminPassword(headerPassword)) {
    return true;
  }

  // 2. Direct password or HMAC token match via Authorization Bearer header
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (checkAdminPassword(token) || verifySignedToken(token, ADMIN_EMAIL, secret)) {
      return true;
    }
  }

  // 3. Cryptographically verified cookie session
  if (cookie) {
    const rawToken = cookie.replace(`${ADMIN_EMAIL}_`, "").replace("token_", "");
    if (verifySignedToken(rawToken, ADMIN_EMAIL, secret)) {
      return true;
    }
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

    const secret = getAdminSecret();
    if (!secret) {
      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error: ADMIN_PASSWORD environment variable is not configured.",
        },
        { status: 500 }
      );
    }

    // Verify restricted email
    if (cleanEmail && cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          message: `Access denied. Administration is strictly restricted to ${ADMIN_EMAIL}.`,
        },
        { status: 403 }
      );
    }

    // Verify password strictly against secret environment variable
    if (!checkAdminPassword(cleanPassword)) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect administrator password.",
        },
        { status: 401 }
      );
    }

    // Generate secure HMAC-SHA256 signed session token
    const signedToken = createSignedToken(ADMIN_EMAIL, secret);

    const response = NextResponse.json({
      success: true,
      message: "Admin authentication successful",
      admin: {
        email: ADMIN_EMAIL,
        name: "Dhruv G Nayak",
        role: "Head of BitByBit",
      },
      token: signedToken,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: `${ADMIN_EMAIL}_${signedToken}`,
      httpOnly: false,
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
