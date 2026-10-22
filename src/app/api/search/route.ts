import { NextRequest, NextResponse } from "next/server";
import { getCertificateByIdOrEmail, getAllCertificates } from "@/lib/certificates-service";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const listAll = searchParams.get("all") === "true";

  if (listAll) {
    const { certificates, stats } = await getAllCertificates();
    const demoItems = certificates.slice(0, 5).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
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

  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return NextResponse.json(
      {
        success: false,
        message: "Please enter your Email Address or Certificate Unique ID to search.",
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  const match = await getCertificateByIdOrEmail(trimmedQuery);

  if (!match) {
    return NextResponse.json(
      {
        success: false,
        message: `No certificate record found for "${trimmedQuery}". Please double check your email or Unique ID.`,
      },
      { status: 404, headers: NO_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      success: true,
      certificate: match,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body?.query || body?.q || body?.id || body?.email || "";
    const trimmedQuery = String(query).trim();

    if (!trimmedQuery) {
      return NextResponse.json(
        {
          success: false,
          message: "Search query is required. Provide an ID or Email.",
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const match = await getCertificateByIdOrEmail(trimmedQuery);

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          message: `No certificate record found for "${trimmedQuery}".`,
        },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        certificate: match,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid request payload.",
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
