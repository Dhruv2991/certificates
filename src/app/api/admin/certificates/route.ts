import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { isValidAdminSession, ADMIN_EMAIL } from "../auth/route";
import { getCertificateEmailStatus } from "@/lib/email-tracker";

const execAsync = promisify(exec);

export interface CertificateRecord {
  id: string;
  name: string;
  email: string;
  type?: "participant" | "volunteer";
  fileUrl: string;
  certificateUrl?: string;
  filename?: string;
  organization?: string;
  college?: string;
  event?: string;
  partner?: string;
  partnerUrl?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  emailCount?: number;
  lastSentBy?: string;
}

const JSON_PATHS = [
  path.join(process.cwd(), "public", "certificates.json"),
  path.join(process.cwd(), "certificates.json"),
  path.join(process.cwd(), "src", "data", "certificates.json"),
];

function readAllCertificates(): CertificateRecord[] {
  for (const fp of JSON_PATHS) {
    if (fs.existsSync(/* turbopackIgnore: true */ fp)) {
      try {
        const data = fs.readFileSync(/* turbopackIgnore: true */ fp, "utf-8");
        const list = JSON.parse(data);
        if (Array.isArray(list)) return list;
      } catch (e) {
        console.error(`Error reading ${fp}:`, e);
      }
    }
  }
  return [];
}

function writeAllCertificates(records: CertificateRecord[]) {
  const jsonStr = JSON.stringify(records, null, 2);
  for (const fp of JSON_PATHS) {
    try {
      const dir = path.dirname(fp);
      if (!fs.existsSync(/* turbopackIgnore: true */ dir)) {
        fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
      }
      fs.writeFileSync(/* turbopackIgnore: true */ fp, jsonStr, "utf-8");
    } catch (e) {
      console.error(`Error writing ${fp}:`, e);
    }
  }
}

// GET: Retrieve all certificates with optional filtering & stats
export async function GET(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type"); // 'participant' | 'volunteer' | null
  const searchFilter = (searchParams.get("q") || "").toLowerCase().trim();

  let list = readAllCertificates();

  const total = list.length;
  const participantsCount = list.filter((c) => c.type === "participant" || c.id.startsWith("PAR") || c.id.startsWith("CLI")).length;
  const volunteersCount = list.filter((c) => c.type === "volunteer" || c.id.startsWith("VOL")).length;

  if (typeFilter && (typeFilter === "participant" || typeFilter === "volunteer")) {
    list = list.filter((c) => (c.type || (c.id.startsWith("VOL") ? "volunteer" : "participant")) === typeFilter);
  }

  if (searchFilter) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(searchFilter) ||
        c.email.toLowerCase().includes(searchFilter) ||
        c.id.toLowerCase().includes(searchFilter)
    );
  }

  const mappedList = list.map((c) => {
    const status = getCertificateEmailStatus(c.id, c.email);
    return {
      ...c,
      emailSent: status.sent || Boolean(c.emailSent),
      emailSentAt: status.sentAt || c.emailSentAt,
      emailCount: status.count || c.emailCount || 0,
      lastSentBy: status.lastSentBy || c.lastSentBy,
    };
  });

  return NextResponse.json({
    success: true,
    stats: {
      total,
      participantsCount,
      volunteersCount,
    },
    certificates: mappedList,
  });
}

// POST: Add a new certificate record and generate its image
export async function POST(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, type } = body;

    const cleanName = String(name || "").trim().replace(/[\[\]]/g, "");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const certType: "participant" | "volunteer" = type === "volunteer" ? "volunteer" : "participant";

    if (!cleanName || !cleanEmail) {
      return NextResponse.json(
        { success: false, message: "Name and email are required fields." },
        { status: 400 }
      );
    }

    const currentList = readAllCertificates();

    // Check duplicate
    const existing = currentList.find(
      (c) => c.email.toLowerCase() === cleanEmail && c.type === certType
    );
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: `A ${certType} certificate already exists for ${cleanEmail} (ID: ${existing.id}).`,
        },
        { status: 409 }
      );
    }

    // Determine next sequential ID
    const prefix = certType === "volunteer" ? "VOL" : "PAR";
    const sameTypeIds = currentList
      .filter((c) => c.id.startsWith(prefix))
      .map((c) => {
        const num = parseInt(c.id.replace(`${prefix}-`, ""), 10);
        return isNaN(num) ? 0 : num;
      });

    const maxNum = sameTypeIds.length > 0 ? Math.max(...sameTypeIds) : 0;
    const nextId = `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
    const filename = `${nextId}.png`;
    const fileUrl = `/certificates/${filename}`;

    const newRecord: CertificateRecord = {
      id: nextId,
      name: cleanName,
      email: cleanEmail,
      type: certType,
      fileUrl: fileUrl,
      certificateUrl: fileUrl,
      filename: filename,
      organization: "TeamCodeLocked",
      college: "B.M.S. College of Engineering",
      event: "Club Orientation 2026",
      partner: "BitByBit",
      partnerUrl: "https://bitbybit-9h8e.vercel.app",
    };

    // Dynamically generate the certificate image via Pillow script
    try {
      const scriptPath = path.join(process.cwd(), "generate_certs.py");
      const cmd = `python "${scriptPath}" --single --name "${cleanName.replace(/"/g, '\\"')}" --id "${nextId}" --type "${certType}"`;
      await execAsync(cmd);
    } catch (genErr) {
      console.error("Certificate image generation warning:", genErr);
    }

    // Save to database
    currentList.push(newRecord);
    writeAllCertificates(currentList);

    return NextResponse.json({
      success: true,
      message: `${certType === "volunteer" ? "Volunteer" : "Participant"} certificate created for ${cleanName} (${nextId})`,
      certificate: newRecord,
    });
  } catch (err) {
    console.error("Error creating certificate:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error creating certificate." },
      { status: 500 }
    );
  }
}

// DELETE: Remove a certificate record by ID
export async function DELETE(request: NextRequest) {
  if (!isValidAdminSession(request)) {
    return NextResponse.json(
      { success: false, message: `Unauthorized. Admin access required (${ADMIN_EMAIL}).` },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");

  if (!id) {
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      // Ignore
    }
  }

  const cleanId = String(id || "").trim();
  if (!cleanId) {
    return NextResponse.json(
      { success: false, message: "Certificate ID is required to delete." },
      { status: 400 }
    );
  }

  const currentList = readAllCertificates();
  const index = currentList.findIndex((c) => c.id.toLowerCase() === cleanId.toLowerCase());

  if (index === -1) {
    return NextResponse.json(
      { success: false, message: `No certificate found with ID "${cleanId}".` },
      { status: 404 }
    );
  }

  const deletedRecord = currentList.splice(index, 1)[0];
  writeAllCertificates(currentList);

  // Attempt to delete physical image if present
  try {
    const imgPath = path.join(process.cwd(), "public", "certificates", deletedRecord.filename || `${cleanId}.png`);
    if (fs.existsSync(/* turbopackIgnore: true */ imgPath)) {
      fs.unlinkSync(/* turbopackIgnore: true */ imgPath);
    }
  } catch (e) {
    console.error("Could not delete image file:", e);
  }

  return NextResponse.json({
    success: true,
    message: `Certificate ${cleanId} (${deletedRecord.name}) has been deleted.`,
    deletedId: cleanId,
  });
}
