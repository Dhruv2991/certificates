import fs from "fs";
import path from "path";
import { sendCertificateViaBrevo } from "./brevo";

export interface EmailDispatchRecord {
  sentAt: string;
  sentTo: string;
  count: number;
  lastSentBy: "user" | "admin";
  messageId?: string;
}

export type EmailDispatchMap = Record<string, EmailDispatchRecord>;

const DISPATCH_FILE_PATH = path.join(process.cwd(), "data", "email_dispatch.json");

const JSON_PATHS = [
  path.join(process.cwd(), "public", "certificates.json"),
  path.join(process.cwd(), "certificates.json"),
  path.join(process.cwd(), "src", "data", "certificates.json"),
];

function readDispatchMap(): EmailDispatchMap {
  try {
    if (fs.existsSync(/* turbopackIgnore: true */ DISPATCH_FILE_PATH)) {
      const content = fs.readFileSync(/* turbopackIgnore: true */ DISPATCH_FILE_PATH, "utf-8");
      return JSON.parse(content) || {};
    }
  } catch (err) {
    console.error("Error reading email_dispatch.json:", err);
  }
  return {};
}

function writeDispatchMap(map: EmailDispatchMap) {
  try {
    const dir = path.dirname(DISPATCH_FILE_PATH);
    if (!fs.existsSync(/* turbopackIgnore: true */ dir)) {
      fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
    }
    fs.writeFileSync(/* turbopackIgnore: true */ DISPATCH_FILE_PATH, JSON.stringify(map, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing email_dispatch.json:", err);
  }
}

/**
 * Checks whether an email has already been dispatched for this certificate.
 */
export function hasEmailBeenSent(certId: string, email?: string): boolean {
  const map = readDispatchMap();
  const idKey = certId.trim().toUpperCase();

  if (map[idKey] && map[idKey].count > 0) {
    return true;
  }

  // Also check if any entry has this exact email
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    for (const key of Object.keys(map)) {
      if (map[key].sentTo?.toLowerCase() === cleanEmail && map[key].count > 0) {
        return true;
      }
    }
  }

  // Check fallback from certificates.json
  for (const fp of JSON_PATHS) {
    if (fs.existsSync(/* turbopackIgnore: true */ fp)) {
      try {
        const list = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ fp, "utf-8"));
        if (Array.isArray(list)) {
          const match = list.find(
            (c: any) =>
              c.id?.toUpperCase() === idKey ||
              (email && c.email?.toLowerCase() === email.trim().toLowerCase())
          );
          if (match && (match.emailSent === true || match.emailCount > 0)) {
            return true;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return false;
}

/**
 * Returns dispatch status for a certificate
 */
export function getCertificateEmailStatus(certId: string, email?: string): {
  sent: boolean;
  sentAt?: string;
  count: number;
  lastSentBy?: "user" | "admin";
} {
  const map = readDispatchMap();
  const idKey = certId.trim().toUpperCase();

  if (map[idKey]) {
    return {
      sent: map[idKey].count > 0,
      sentAt: map[idKey].sentAt,
      count: map[idKey].count,
      lastSentBy: map[idKey].lastSentBy,
    };
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    for (const key of Object.keys(map)) {
      if (map[key].sentTo?.toLowerCase() === cleanEmail) {
        return {
          sent: map[key].count > 0,
          sentAt: map[key].sentAt,
          count: map[key].count,
          lastSentBy: map[key].lastSentBy,
        };
      }
    }
  }

  return { sent: false, count: 0 };
}

/**
 * Records that an email was successfully sent.
 * Updates both the dispatch map and all certificates.json files.
 */
export function recordEmailSent(
  certId: string,
  email: string,
  triggeredBy: "user" | "admin",
  messageId?: string
) {
  const idKey = certId.trim().toUpperCase();
  const now = new Date().toISOString();

  const map = readDispatchMap();
  const existing = map[idKey] || {
    sentAt: now,
    sentTo: email,
    count: 0,
    lastSentBy: triggeredBy,
  };

  map[idKey] = {
    sentAt: now,
    sentTo: email,
    count: (existing.count || 0) + 1,
    lastSentBy: triggeredBy,
    messageId: messageId || existing.messageId,
  };

  writeDispatchMap(map);

  // Sync with certificates.json files
  for (const fp of JSON_PATHS) {
    if (fs.existsSync(/* turbopackIgnore: true */ fp)) {
      try {
        const list = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ fp, "utf-8"));
        if (Array.isArray(list)) {
          let updated = false;
          for (const item of list) {
            if (item.id?.toUpperCase() === idKey) {
              item.emailSent = true;
              item.emailSentAt = now;
              item.emailCount = map[idKey].count;
              item.lastSentBy = triggeredBy;
              updated = true;
              break;
            }
          }
          if (updated) {
            fs.writeFileSync(/* turbopackIgnore: true */ fp, JSON.stringify(list, null, 2), "utf-8");
          }
        }
      } catch (e) {
        console.error(`Error updating certificates in ${fp}:`, e);
      }
    }
  }
}

/**
 * Admin action to forcefully resend certificate email
 */
export async function adminResendCertificateEmail(
  certId: string,
  customEmail?: string,
  appUrl?: string
): Promise<{ success: boolean; message: string; messageId?: string; sentAt?: string }> {
  let certRecord: any = null;

  for (const fp of JSON_PATHS) {
    if (fs.existsSync(/* turbopackIgnore: true */ fp)) {
      try {
        const list = JSON.parse(fs.readFileSync(/* turbopackIgnore: true */ fp, "utf-8"));
        if (Array.isArray(list)) {
          const match = list.find((c: any) => c.id?.toUpperCase() === certId.trim().toUpperCase());
          if (match) {
            certRecord = match;
            break;
          }
        }
      } catch {}
    }
  }

  if (!certRecord) {
    return {
      success: false,
      message: `Certificate '${certId}' not found in registry.`,
    };
  }

  const recipientEmail = (customEmail || certRecord.email || "").trim();
  if (!recipientEmail) {
    return {
      success: false,
      message: `No recipient email available for certificate '${certId}'.`,
    };
  }

  const certType: "participant" | "volunteer" =
    certRecord.type || (certRecord.id?.startsWith("VOL") ? "volunteer" : "participant");

  const sendResult = await sendCertificateViaBrevo({
    recipientName: certRecord.name,
    recipientEmail,
    certificateId: certRecord.id,
    certificateType: certType,
    filename: certRecord.filename,
    appUrl,
  });

  if (sendResult.sent) {
    recordEmailSent(certRecord.id, recipientEmail, "admin", sendResult.messageId);
    return {
      success: true,
      message: `Certificate email successfully dispatched to ${recipientEmail}.`,
      messageId: sendResult.messageId,
      sentAt: new Date().toISOString(),
    };
  } else {
    return {
      success: false,
      message: sendResult.error || "Failed to dispatch email via Brevo.",
    };
  }
}
