import {
  getSupabaseServerClient,
  mapSupabaseToApp,
  mapAppToSupabase,
  AppCertificateRecord,
  SupabaseCertificateRow,
} from "./supabase";

/**
 * Retrieve all certificates with optional filtering, search, and sorting.
 * Interacts exclusively with Supabase PostgreSQL (public.certificates table).
 */
export async function getAllCertificates(params?: {
  typeFilter?: "participant" | "volunteer" | null;
  searchFilter?: string;
  sortOrder?: "newest" | "oldest";
}): Promise<{
  certificates: AppCertificateRecord[];
  stats: { total: number; participantsCount: number; volunteersCount: number };
}> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    console.warn("[Certificates Service] Supabase client is not configured.");
    return {
      certificates: [],
      stats: { total: 0, participantsCount: 0, volunteersCount: 0 },
    };
  }

  try {
    let query = supabase.from("certificates").select("*");

    if (params?.typeFilter) {
      query = query.eq("type", params.typeFilter);
    }

    if (params?.searchFilter) {
      const q = params.searchFilter.trim();
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,id.ilike.%${q}%`);
    }

    const ascending = params?.sortOrder === "oldest";
    query = query.order("id", { ascending });

    const { data, error } = await query;

    if (error) {
      console.error("[Certificates Service] Supabase query error in getAllCertificates:", error.message);
      return {
        certificates: [],
        stats: { total: 0, participantsCount: 0, volunteersCount: 0 },
      };
    }

    const mappedList = (data as SupabaseCertificateRow[] || []).map(mapSupabaseToApp);

    // Fetch overall stats directly from Supabase
    const { count: totalCount } = await supabase
      .from("certificates")
      .select("*", { count: "exact", head: true });
    const { count: partCount } = await supabase
      .from("certificates")
      .select("*", { count: "exact", head: true })
      .eq("type", "participant");
    const { count: volCount } = await supabase
      .from("certificates")
      .select("*", { count: "exact", head: true })
      .eq("type", "volunteer");

    return {
      certificates: mappedList,
      stats: {
        total: totalCount || mappedList.length,
        participantsCount: partCount || 0,
        volunteersCount: volCount || 0,
      },
    };
  } catch (err) {
    console.error("[Certificates Service] Supabase exception in getAllCertificates:", err);
    return {
      certificates: [],
      stats: { total: 0, participantsCount: 0, volunteersCount: 0 },
    };
  }
}

/**
 * Search for a single certificate by exact Unique ID or Email.
 * Interacts exclusively with Supabase PostgreSQL (public.certificates table).
 */
export async function getCertificateByIdOrEmail(queryStr: string): Promise<AppCertificateRecord | null> {
  const clean = queryStr.trim().toLowerCase();
  if (!clean) return null;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("[Certificates Service] Supabase client is not configured.");
    return null;
  }

  try {
    // 1. Direct match on ID or Email (case-insensitive)
    const { data, error } = await supabase
      .from("certificates")
      .select("*")
      .or(`id.ilike.${clean},email.ilike.${clean}`)
      .limit(1);

    if (!error && data && data.length > 0) {
      return mapSupabaseToApp(data[0] as SupabaseCertificateRow);
    }

    // 2. Alphanumeric match fallback (e.g. PAR001 instead of PAR-001)
    const alphaNum = clean.replace(/[^a-z0-9]/g, "");
    if (alphaNum.length >= 3) {
      const { data: allData } = await supabase
        .from("certificates")
        .select("*")
        .limit(1000);

      if (allData) {
        const match = allData.find((row) => {
          const cleanId = row.id.toLowerCase().replace(/[^a-z0-9]/g, "");
          return cleanId === alphaNum;
        });
        if (match) return mapSupabaseToApp(match as SupabaseCertificateRow);
      }
    }
  } catch (err) {
    console.error("[Certificates Service] Supabase error in getCertificateByIdOrEmail:", err);
  }

  return null;
}

/**
 * Create a new certificate record in Supabase database.
 * Completely free of local file system writes.
 */
export async function createCertificateRecord(record: AppCertificateRecord): Promise<{
  success: boolean;
  certificate: AppCertificateRecord;
  message?: string;
}> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client is not configured. Cannot create certificate in database.");
  }

  const row = mapAppToSupabase(record);
  const { data, error } = await supabase
    .from("certificates")
    .insert([row])
    .select()
    .single();

  if (error) {
    console.error("[Certificates Service] Supabase insert error:", error);
    throw new Error(error.message);
  }

  const created = mapSupabaseToApp(data as SupabaseCertificateRow);
  return { success: true, certificate: created };
}

/**
 * Update an existing certificate record in Supabase database.
 */
export async function updateCertificateRecord(
  id: string,
  updates: Partial<AppCertificateRecord>
): Promise<{ success: boolean; certificate?: AppCertificateRecord; error?: string }> {
  const cleanId = id.trim();
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return { success: false, error: "Supabase client is not configured." };
  }

  const dbUpdates: Partial<SupabaseCertificateRow> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.email !== undefined) dbUpdates.email = updates.email.toLowerCase().trim();
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.fileUrl !== undefined) dbUpdates.file_url = updates.fileUrl;
  if (updates.certificateUrl !== undefined) dbUpdates.certificate_url = updates.certificateUrl;
  if (updates.filename !== undefined) dbUpdates.filename = updates.filename;
  if (updates.emailSent !== undefined) dbUpdates.email_sent = updates.emailSent;
  if (updates.emailSentAt !== undefined) dbUpdates.email_sent_at = updates.emailSentAt;
  if (updates.emailCount !== undefined) dbUpdates.email_count = updates.emailCount;
  if (updates.lastSentBy !== undefined) dbUpdates.last_sent_by = updates.lastSentBy;

  try {
    const { data, error } = await supabase
      .from("certificates")
      .update(dbUpdates)
      .ilike("id", cleanId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, certificate: mapSupabaseToApp(data as SupabaseCertificateRow) };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update certificate" };
  }
}

/**
 * Delete a certificate record by ID from Supabase database.
 * Completely free of local file system writes.
 */
export async function deleteCertificateRecord(id: string): Promise<{
  success: boolean;
  deletedRecord?: AppCertificateRecord;
}> {
  const cleanId = id.trim();
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return { success: false };
  }

  let deletedRecord: AppCertificateRecord | undefined;

  try {
    const { data } = await supabase
      .from("certificates")
      .select("*")
      .ilike("id", cleanId)
      .single();

    if (data) {
      deletedRecord = mapSupabaseToApp(data as SupabaseCertificateRow);
    } else {
      return { success: false };
    }

    await supabase.from("certificates").delete().ilike("id", cleanId);
    return { success: true, deletedRecord };
  } catch (err) {
    console.error("[Certificates Service] Supabase delete error:", err);
    return { success: false };
  }
}

/**
 * Determine the next sequential certificate ID (e.g. PAR-270 or VOL-020) via Supabase.
 */
export async function getNextCertificateId(certType: "participant" | "volunteer"): Promise<string> {
  const prefix = certType === "volunteer" ? "VOL" : "PAR";
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("certificates")
        .select("id")
        .like("id", `${prefix}-%`);

      if (!error && data) {
        const numbers = data.map((r) => {
          const num = parseInt(r.id.replace(`${prefix}-`, ""), 10);
          return isNaN(num) ? 0 : num;
        });
        const max = numbers.length > 0 ? Math.max(...numbers) : 0;
        return `${prefix}-${String(max + 1).padStart(3, "0")}`;
      }
    } catch (err) {
      console.error("[Certificates Service] Error calculating next ID from Supabase:", err);
    }
  }

  return `${prefix}-001`;
}

/**
 * Record email dispatch directly in Supabase using the existing table columns:
 * email_sent, email_count, email_sent_at, last_sent_by.
 */
export async function recordEmailSentInDB(
  certId: string,
  email: string,
  triggeredBy: "user" | "admin"
): Promise<{ success: boolean; count: number; sentAt: string }> {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    console.warn("[Certificates Service] Supabase not configured. Skipped DB email record.");
    return { success: false, count: 0, sentAt: now };
  }

  try {
    // 1. Fetch current email_count
    const { data } = await supabase
      .from("certificates")
      .select("email_count")
      .or(`id.ilike.${certId},email.ilike.${email}`)
      .limit(1);

    const currentCount = data?.[0]?.email_count || 0;
    const newCount = currentCount + 1;

    // 2. Update Supabase columns
    const { error } = await supabase
      .from("certificates")
      .update({
        email_sent: true,
        email_sent_at: now,
        email_count: newCount,
        last_sent_by: triggeredBy,
      })
      .or(`id.ilike.${certId},email.ilike.${email}`);

    if (error) {
      console.error("[Certificates Service] Error updating email status in Supabase:", error.message);
      return { success: false, count: currentCount, sentAt: now };
    }

    return { success: true, count: newCount, sentAt: now };
  } catch (err) {
    console.error("[Certificates Service] Exception updating email status in Supabase:", err);
    return { success: false, count: 0, sentAt: now };
  }
}
