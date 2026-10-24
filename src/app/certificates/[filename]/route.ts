import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getCertificateByIdOrEmail } from "@/lib/certificates-service";
import { renderCertificateImageResponse, renderCertificatePngBuffer } from "@/lib/certificate-renderer";

interface RouteParams {
  params: Promise<{
    filename: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { filename } = await params;

  if (!filename) {
    return NextResponse.json({ success: false, message: "Missing filename." }, { status: 400 });
  }

  // 1. Check if the static file exists on disk
  const localDiskPath = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "certificates", filename);
  if (fs.existsSync(/* turbopackIgnore: true */ localDiskPath)) {
    try {
      const fileBuffer = fs.readFileSync(/* turbopackIgnore: true */ localDiskPath);
      return new Response(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    } catch {
      // Fall through to dynamic generation
    }
  }

  // 2. Extract ID (e.g. PAR-270.png -> PAR-270)
  const certId = filename.replace(/\.[^/.]+$/, "").trim();
  if (!certId) {
    return NextResponse.json({ success: false, message: "Invalid certificate filename." }, { status: 400 });
  }

  // 3. Query Supabase registry
  const match = await getCertificateByIdOrEmail(certId);
  if (!match) {
    return NextResponse.json(
      { success: false, message: `Certificate '${certId}' not found in registry.` },
      { status: 404 }
    );
  }

  const certType = match.type || (match.id.startsWith("VOL") ? "volunteer" : "participant");

  // 4. In local writable dev, cache to disk asynchronously
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      renderCertificatePngBuffer({
        name: match.name,
        type: certType,
        id: match.id,
      }).then((buf) => {
        const outDir = path.join(process.cwd(), "public", "certificates");
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        fs.writeFileSync(localDiskPath, buf);
      }).catch((e) => {
        console.error("Local disk image cache warning:", e);
      });
    } catch {
      // Ignore cache write error
    }
  }

  // 5. Render dynamically using Next.js ImageResponse
  return renderCertificateImageResponse({
    name: match.name,
    type: certType,
    id: match.id,
  });
}
