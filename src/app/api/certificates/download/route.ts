import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCertificateByIdOrEmail } from "@/lib/certificates-service";

function findCertificateFile(filename: string): string | null {
  const candidatePaths = [
    path.join(process.cwd(), "public", "certificates", filename),
    path.join(process.cwd(), "certificates", filename),
    path.resolve("public", "certificates", filename),
    path.resolve("certificates", filename),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(/* turbopackIgnore: true */ p)) {
      return p;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() || "";
  const filenameParam = searchParams.get("filename")?.trim() || "";

  if (!id && !filenameParam) {
    return NextResponse.json(
      { success: false, message: "Missing 'id' or 'filename' parameter." },
      { status: 400 }
    );
  }

  const lookupTerm = id || filenameParam.replace(/\.png$/i, "");
  // Fetch exclusively from Supabase
  const match = await getCertificateByIdOrEmail(lookupTerm);

  // If match has a remote fileUrl, redirect directly to remote storage
  if (match?.fileUrl && (match.fileUrl.startsWith("http://") || match.fileUrl.startsWith("https://"))) {
    return NextResponse.redirect(match.fileUrl);
  }

  const certFileName = match?.filename || filenameParam || `${id}.png`;
  const filePath = findCertificateFile(certFileName);

  if (!filePath) {
    return NextResponse.json(
      { success: false, message: `Certificate file '${certFileName}' not found.` },
      { status: 404 }
    );
  }

  try {
    const fileBuffer = fs.readFileSync(/* turbopackIgnore: true */ filePath);
    const recipientName = match?.name || "Participant";
    const certId = match?.id || id || "CERT";
    const safeName = recipientName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const downloadFilename = `Certificate_${safeName}_${certId}.png`;

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: any) {
    console.error("Error serving certificate download:", err);
    return NextResponse.json(
      { success: false, message: "Failed to read certificate file." },
      { status: 500 }
    );
  }
}
