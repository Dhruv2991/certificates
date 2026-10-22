import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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

function loadCertificates(): any[] {
  const candidatePaths = [
    path.join(process.cwd(), "public", "certificates.json"),
    path.join(process.cwd(), "certificates.json"),
    path.join(process.cwd(), "src", "data", "certificates.json"),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      try {
        const fileContent = fs.readFileSync(/* turbopackIgnore: true */ filePath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) return parsed;
      } catch (err) {
        console.error("Error reading certificates.json in download route:", err);
      }
    }
  }
  return [];
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

  const certificates = loadCertificates();
  const match = certificates.find(
    (c) =>
      (id && c.id.toLowerCase() === id.toLowerCase()) ||
      (filenameParam && (c.filename === filenameParam || c.id === filenameParam.replace(/\.png$/i, "")))
  );

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
