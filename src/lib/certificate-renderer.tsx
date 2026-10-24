import fs from "fs";
import path from "path";
import React from "react";
import { ImageResponse } from "next/og";

export interface RenderCertificateOptions {
  name: string;
  type: "participant" | "volunteer";
  id?: string;
  college?: string;
  event?: string;
  organization?: string;
}

// In-memory cache for template Base64 strings to avoid reading disk repeatedly
let participantTemplateBase64: string | null = null;
let volunteerTemplateBase64: string | null = null;

function getTemplateBase64(type: "participant" | "volunteer"): string {
  const isVol = type === "volunteer";
  if (isVol && volunteerTemplateBase64) return volunteerTemplateBase64;
  if (!isVol && participantTemplateBase64) return participantTemplateBase64;

  const candidateNames = isVol
    ? ["template_volunteer.png", "Volunteer 2.png"]
    : ["template_participant.png", "2.png"];

  for (const name of candidateNames) {
    const candidatePath = path.join(/* turbopackIgnore: true */ process.cwd(), name);
    if (fs.existsSync(/* turbopackIgnore: true */ candidatePath)) {
      try {
        const buf = fs.readFileSync(/* turbopackIgnore: true */ candidatePath);
        const base64 = `data:image/png;base64,${buf.toString("base64")}`;
        if (isVol) volunteerTemplateBase64 = base64;
        else participantTemplateBase64 = base64;
        return base64;
      } catch (err) {
        console.error(`Error reading template ${name}:`, err);
      }
    }
  }

  throw new Error(`Certificate template for ${type} not found.`);
}

/**
 * Dynamically generates a high-resolution PNG Response for a certificate
 * using Next.js native ImageResponse (Satori + Resvg).
 * Zero external binaries required; works on Vercel Serverless, Edge, and local dev.
 */
export async function renderCertificateImageResponse(
  options: RenderCertificateOptions
): Promise<Response> {
  const { name, type } = options;
  const cleanName = String(name || "").trim().replace(/[\[\]]/g, "") || "Participant";
  const templateBase64 = getTemplateBase64(type);

  // Exact coordinates matching the official 1024x723 templates
  // White box clears [RECIPIENT NAME] placeholder
  // Text draws clean recipient name in bold #111827 font
  const element = (
    <div
      style={{
        position: "relative",
        width: 1024,
        height: 723,
        display: "flex",
      }}
    >
      {/* Background Template */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={templateBase64}
        alt="Certificate Template"
        width={1024}
        height={723}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1024,
          height: 723,
        }}
      />

      {/* Clean White Mask over template placeholder */}
      <div
        style={{
          position: "absolute",
          top: 368,
          left: 122,
          width: 774,
          height: 76,
          backgroundColor: "#ffffff",
        }}
      />

      {/* Recipient Name */}
      <div
        style={{
          position: "absolute",
          top: 380,
          left: 134,
          fontSize: 46,
          fontWeight: 700,
          color: "#111827",
          fontFamily: "sans-serif",
          letterSpacing: "-0.5px",
        }}
      >
        {cleanName}
      </div>
    </div>
  );

  return new ImageResponse(element, {
    width: 1024,
    height: 723,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

/**
 * Returns raw PNG Buffer for email attachment or file persistence.
 */
export async function renderCertificatePngBuffer(
  options: RenderCertificateOptions
): Promise<Buffer> {
  const response = await renderCertificateImageResponse(options);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
