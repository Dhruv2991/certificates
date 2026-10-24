import { sendCertificateViaBrevo } from "./brevo";
import { getSupabaseServerClient } from "./supabase";
import { getCertificateByIdOrEmail, recordEmailSentInDB } from "./certificates-service";

export interface EmailDispatchRecord {
  sentAt: string;
  sentTo: string;
  count: number;
  lastSentBy: "user" | "admin";
  messageId?: string;
}

/**
 * Checks whether an email has already been dispatched for this certificate
 * by querying the Supabase public.certificates table.
 */
export async function hasEmailBeenSent(certId: string, email?: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;

  const cleanId = certId.trim();
  const cleanEmail = email?.trim().toLowerCase();

  try {
    const orCondition = cleanEmail
      ? `id.ilike.${cleanId},email.ilike.${cleanEmail}`
      : `id.ilike.${cleanId}`;

    const { data, error } = await supabase
      .from("certificates")
      .select("email_sent, email_count")
      .or(orCondition)
      .limit(1);

    if (error || !data || data.length === 0) {
      return false;
    }

    const row = data[0];
    return Boolean(row.email_sent || (row.email_count && row.email_count > 0));
  } catch (err) {
    console.error("[Email Tracker] Error checking email dispatch in Supabase:", err);
    return false;
  }
}

/**
 * Returns dispatch status for a certificate directly from Supabase columns:
 * email_sent, email_sent_at, email_count, last_sent_by.
 */
export async function getCertificateEmailStatus(certId: string, email?: string): Promise<{
  sent: boolean;
  sentAt?: string;
  count: number;
  lastSentBy?: "user" | "admin";
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { sent: false, count: 0 };

  const cleanId = certId.trim();
  const cleanEmail = email?.trim().toLowerCase();

  try {
    const orCondition = cleanEmail
      ? `id.ilike.${cleanId},email.ilike.${cleanEmail}`
      : `id.ilike.${cleanId}`;

    const { data, error } = await supabase
      .from("certificates")
      .select("email_sent, email_sent_at, email_count, last_sent_by")
      .or(orCondition)
      .limit(1);

    if (error || !data || data.length === 0) {
      return { sent: false, count: 0 };
    }

    const row = data[0];
    return {
      sent: Boolean(row.email_sent),
      sentAt: row.email_sent_at,
      count: row.email_count || 0,
      lastSentBy: row.last_sent_by as "user" | "admin" | undefined,
    };
  } catch (err) {
    console.error("[Email Tracker] Error fetching email status from Supabase:", err);
    return { sent: false, count: 0 };
  }
}

/**
 * Records that an email was successfully sent.
 * Exclusively updates Supabase columns (email_sent, email_count, email_sent_at, last_sent_by).
 * Completely free of local file operations (no email_dispatch.json / certificates.json writes).
 */
export async function recordEmailSent(
  certId: string,
  email: string,
  triggeredBy: "user" | "admin",
  _messageId?: string
): Promise<void> {
  try {
    await recordEmailSentInDB(certId, email, triggeredBy);
  } catch (err) {
    console.error("[Email Tracker] Error recording email dispatch in Supabase:", err);
  }
}

/**
 * Admin action to forcefully resend certificate email.
 * Interacts exclusively with Supabase and Brevo API.
 */
export async function adminResendCertificateEmail(
  certId: string,
  customEmail?: string,
  appUrl?: string
): Promise<{ success: boolean; message: string; messageId?: string; sentAt?: string; emailCount?: number }> {
  // 1. Fetch certificate exclusively from Supabase
  const certRecord = await getCertificateByIdOrEmail(certId);

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

  // 2. Dispatch via Brevo
  const sendResult = await sendCertificateViaBrevo({
    recipientName: certRecord.name,
    recipientEmail,
    certificateId: certRecord.id,
    certificateType: certType,
    filename: certRecord.filename,
    appUrl,
  });

  if (sendResult.sent) {
    // 3. Record dispatch directly in Supabase
    const dbResult = await recordEmailSentInDB(certRecord.id, recipientEmail, "admin");
    return {
      success: true,
      message: `Certificate email successfully dispatched to ${recipientEmail}.`,
      messageId: sendResult.messageId,
      sentAt: dbResult.sentAt,
      emailCount: dbResult.count,
    };
  } else {
    return {
      success: false,
      message: sendResult.error || "Failed to dispatch email via Brevo.",
    };
  }
}
