import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface CertificateRecord {
  id: string;
  name: string;
  email: string;
  certificateUrl: string;
  filename?: string;
  issueDate?: string;
  orientationEvent?: string;
}

function getCertificates(): CertificateRecord[] {
  // Check both root certificates.json and src/data/certificates.json
  const candidatePaths = [
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
        console.error(`Error parsing certificates file at ${filePath}:`, err);
      }
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const listAll = searchParams.get("all") === "true";

  const certificates = getCertificates();

  if (listAll) {
    // Return sample list (without private fields if desired, or sample demo IDs)
    const demoItems = certificates.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
    }));
    return NextResponse.json({
      success: true,
      total: certificates.length,
      demoItems,
    });
  }

  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return NextResponse.json(
      {
        success: false,
        message: "Please enter your Email Address or Certificate Unique ID to search.",
      },
      { status: 400 }
    );
  }

  // Exact match first (case-insensitive) on email or id
  let match = certificates.find(
    (c) =>
      c.id.toLowerCase() === trimmedQuery ||
      c.email.toLowerCase() === trimmedQuery
  );

  // Fallback: match without spaces or hyphens if user omitted hyphens in ID (e.g., CLUB2026001 instead of CLUB-2026-001)
  if (!match) {
    const alphanumericQuery = trimmedQuery.replace(/[^a-z0-9]/g, "");
    if (alphanumericQuery.length >= 3) {
      match = certificates.find((c) => {
        const cleanId = c.id.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanId === alphanumericQuery;
      });
    }
  }

  if (!match) {
    return NextResponse.json(
      {
        success: false,
        message: `No certificate record found for "${query.trim()}". Please double check your email or Unique ID.`,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    certificate: match,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body?.query || body?.q || body?.id || body?.email || "";
    const trimmedQuery = String(query).trim().toLowerCase();

    if (!trimmedQuery) {
      return NextResponse.json(
        {
          success: false,
          message: "Search query is required. Provide an ID or Email.",
        },
        { status: 400 }
      );
    }

    const certificates = getCertificates();
    const match = certificates.find(
      (c) =>
        c.id.toLowerCase() === trimmedQuery ||
        c.email.toLowerCase() === trimmedQuery
    );

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message: `No certificate record found for "${query}".`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      certificate: match,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request payload.",
      },
      { status: 400 }
    );
  }
}
