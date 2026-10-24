import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseCertificateRow {
  id: string;
  name: string;
  email: string;
  type: "participant" | "volunteer";
  file_url: string;
  certificate_url?: string;
  filename?: string;
  organization?: string;
  college?: string;
  event?: string;
  partner?: string;
  partner_url?: string;
  email_sent?: boolean;
  email_sent_at?: string;
  email_count?: number;
  last_sent_by?: string;
  created_at?: string;
}

export interface AppCertificateRecord {
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
  createdAt?: string;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("your-project") && !key.includes("your-key"));
}

let serverClientInstance: SupabaseClient | null = null;
let publicClientInstance: SupabaseClient | null = null;

/**
 * Returns the Supabase client with Service Role privileges for secure server-side mutations.
 * Falls back to anon key if service role is not provided.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (serverClientInstance) {
    return serverClientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  serverClientInstance = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return serverClientInstance;
}

/**
 * Returns the public anon Supabase client for client-side or anonymous reads.
 */
export function getSupabasePublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (publicClientInstance) {
    return publicClientInstance;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  publicClientInstance = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return publicClientInstance;
}

/**
 * Convert a Supabase database row to the app's internal CertificateRecord model
 */
export function mapSupabaseToApp(row: SupabaseCertificateRow): AppCertificateRecord {
  const isBitByBitPlaceholder = row.file_url?.includes("bitbybit-9h8e.vercel.app/certificates/");
  const baseFilename = row.filename?.replace(/\.pdf$/i, ".png") || `${row.id}.png`;
  const fileUrl =
    !isBitByBitPlaceholder && (row.file_url || row.certificate_url)
      ? (row.file_url || row.certificate_url!)
      : `/certificates/${baseFilename}`;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    type: row.type || (row.id.startsWith("VOL") ? "volunteer" : "participant"),
    fileUrl: fileUrl,
    certificateUrl: row.certificate_url || fileUrl,
    filename: baseFilename,
    organization: row.organization || "TeamCodeLocked",
    college: row.college || "B.M.S. College of Engineering",
    event: row.event || "Club Orientation 2026",
    partner: row.partner || "BitByBit",
    partnerUrl: row.partner_url || "https://bitbybit-9h8e.vercel.app",
    emailSent: Boolean(row.email_sent),
    emailSentAt: row.email_sent_at,
    emailCount: row.email_count || 0,
    lastSentBy: row.last_sent_by,
    createdAt: row.created_at,
  };
}

/**
 * Convert an app CertificateRecord to a Supabase table row
 */
export function mapAppToSupabase(cert: AppCertificateRecord): SupabaseCertificateRow {
  const certType: "participant" | "volunteer" =
    cert.type === "volunteer" || cert.id.startsWith("VOL") ? "volunteer" : "participant";
  const fileUrl = cert.fileUrl || cert.certificateUrl || `/certificates/${cert.id}.png`;

  return {
    id: cert.id,
    name: cert.name,
    email: cert.email.toLowerCase().trim(),
    type: certType,
    file_url: fileUrl,
    certificate_url: cert.certificateUrl || fileUrl,
    filename: cert.filename || `${cert.id}.png`,
    organization: cert.organization || "TeamCodeLocked",
    college: cert.college || "B.M.S. College of Engineering",
    event: cert.event || "Club Orientation 2026",
    partner: cert.partner || "BitByBit",
    partner_url: cert.partnerUrl || "https://bitbybit-9h8e.vercel.app",
    email_sent: Boolean(cert.emailSent),
    email_sent_at: cert.emailSentAt,
    email_count: cert.emailCount || 0,
    last_sent_by: cert.lastSentBy,
  };
}
