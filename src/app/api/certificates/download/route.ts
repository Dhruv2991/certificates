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

  let fileBuffer: Buffer | null = null;
  if (filePath) {
    try {
      fileBuffer = fs.readFileSync(/* turbopackIgnore: true */ filePath);
    } catch (e) {
      console.warn("Could not read static certificate file from disk:", e);
    }
  }

  // If file is not on disk (e.g. on Vercel or newly re-issued), render dynamically
  if (!fileBuffer && match) {
    try {
      const { renderCertificatePngBuffer } = await import("@/lib/certificate-renderer");
      const certType = match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");
      fileBuffer = await renderCertificatePngBuffer({
        name: match.name,
        type: certType,
        id: match.id,
      });
    } catch (renderErr) {
      console.error("Dynamic certificate render error on download:", renderErr);
    }
  }

  if (!fileBuffer) {
    return NextResponse.json(
      { success: false, message: `Certificate file '${certFileName}' not found.` },
      { status: 404 }
    );
  }

  const recipientName = match?.name || "Participant";
  const certId = match?.id || id || "CERT";
  const safeName = recipientName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const downloadFilename = `Certificate_${safeName}_${certId}.png`;

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    },
  });
}
