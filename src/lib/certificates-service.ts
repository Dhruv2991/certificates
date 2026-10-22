import fs from "fs";
import path from "path";
import {
  getSupabaseServerClient,
  isSupabaseConfigured,
  mapSupabaseToApp,
  mapAppToSupabase,
  AppCertificateRecord,
  SupabaseCertificateRow,
} from "./supabase";
import { getCertificateEmailStatus } from "./email-tracker";

const JSON_PATHS = [
  path.join(process.cwd(), "public", "certificates.json"),
  path.join(process.cwd(), "certificates.json"),
  path.join(process.cwd(), "src", "data", "certificates.json"),
];

function readLocalCertificates(): AppCertificateRecord[] {
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

function writeLocalCertificates(records: AppCertificateRecord[]) {
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

/**
 * Retrieve all certificates with optional filtering, search, and sorting
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

  if (supabase) {
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

      if (!error && data) {
        const mappedList = (data as SupabaseCertificateRow[]).map(mapSupabaseToApp);

        // Fetch overall stats
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
      } else if (error) {
        console.error("Supabase query error in getAllCertificates:", error.message);
      }
    } catch (err) {
      console.error("Supabase connection error, falling back to local storage:", err);
    }
  }

  // Local fallback
  let list = readLocalCertificates();
  const total = list.length;
  const participantsCount = list.filter(
    (c) => c.type === "participant" || c.id.startsWith("PAR") || c.id.startsWith("CLI")
  ).length;
  const volunteersCount = list.filter((c) => c.type === "volunteer" || c.id.startsWith("VOL")).length;

  if (params?.typeFilter) {
    list = list.filter(
      (c) => (c.type || (c.id.startsWith("VOL") ? "volunteer" : "participant")) === params.typeFilter
    );
  }

  if (params?.searchFilter) {
    const s = params.searchFilter.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s)
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

  if (params?.sortOrder !== "oldest") {
    mappedList.reverse();
  }

  return {
    certificates: mappedList,
    stats: {
      total,
      participantsCount,
      volunteersCount,
    },
  };
}

/**
 * Search for a single certificate by exact Unique ID or Email
 */
export async function getCertificateByIdOrEmail(queryStr: string): Promise<AppCertificateRecord | null> {
  const clean = queryStr.trim().toLowerCase();
  if (!clean) return null;

  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      // 1. Check exact match on ID or Email
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
      console.error("Supabase error in getCertificateByIdOrEmail:", err);
    }
  }

  // Local fallback
  const list = readLocalCertificates();
  let match = list.find((c) => c.id.toLowerCase() === clean || c.email.toLowerCase() === clean);

  if (!match) {
    const alphaNum = clean.replace(/[^a-z0-9]/g, "");
    if (alphaNum.length >= 3) {
      match = list.find((c) => {
        const cleanId = c.id.toLowerCase().replace(/[^a-z0-9]/g, "");
        return cleanId === alphaNum;
      });
    }
  }

  return match || null;
}

/**
 * Create a new certificate record in Supabase and sync locally
 */
export async function createCertificateRecord(record: AppCertificateRecord): Promise<{
  success: boolean;
  certificate: AppCertificateRecord;
  message?: string;
}> {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const row = mapAppToSupabase(record);
      const { data, error } = await supabase
        .from("certificates")
        .insert([row])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(error.message);
      }

      const created = mapSupabaseToApp(data as SupabaseCertificateRow);

      // Also append to local files if filesystem is writable
      try {
        const currentList = readLocalCertificates();
        if (!currentList.some((c) => c.id.toLowerCase() === created.id.toLowerCase())) {
          currentList.push(created);
          writeLocalCertificates(currentList);
        }
      } catch {}

      return { success: true, certificate: created };
    } catch (err: any) {
      console.error("Supabase insert exception, trying local fallback:", err.message);
    }
  }

  // Local fallback
  const currentList = readLocalCertificates();
  currentList.push(record);
  writeLocalCertificates(currentList);

  return { success: true, certificate: record };
}

/**
 * Delete a certificate record by ID from Supabase and local storage
 */
export async function deleteCertificateRecord(id: string): Promise<{ success: boolean; deletedRecord?: AppCertificateRecord }> {
  const cleanId = id.trim();
  const supabase = getSupabaseServerClient();

  let deletedRecord: AppCertificateRecord | undefined;

  if (supabase) {
    try {
      const { data } = await supabase
        .from("certificates")
        .select("*")
        .ilike("id", cleanId)
        .single();

      if (data) {
        deletedRecord = mapSupabaseToApp(data as SupabaseCertificateRow);
      }

      await supabase.from("certificates").delete().ilike("id", cleanId);
    } catch (err) {
      console.error("Supabase delete error:", err);
    }
  }

  // Also remove from local files
  try {
    const currentList = readLocalCertificates();
    const index = currentList.findIndex((c) => c.id.toLowerCase() === cleanId.toLowerCase());
    if (index !== -1) {
      const removed = currentList.splice(index, 1)[0];
      if (!deletedRecord) deletedRecord = removed;
      writeLocalCertificates(currentList);
    }
  } catch {}

  return { success: true, deletedRecord };
}

/**
 * Determine the next sequential certificate ID (e.g. PAR-270 or VOL-020)
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
      console.error("Error calculating next ID from Supabase:", err);
    }
  }

  // Fallback to local
  const currentList = readLocalCertificates();
  const sameTypeIds = currentList
    .filter((c) => c.id.startsWith(prefix))
    .map((c) => {
      const num = parseInt(c.id.replace(`${prefix}-`, ""), 10);
      return isNaN(num) ? 0 : num;
    });

  const maxNum = sameTypeIds.length > 0 ? Math.max(...sameTypeIds) : 0;
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Record email dispatch in Supabase and local storage
 */
export async function recordEmailSentInDB(
  certId: string,
  email: string,
  triggeredBy: "user" | "admin"
) {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();

  if (supabase) {
    try {
      // Fetch current count
      const { data } = await supabase
        .from("certificates")
        .select("email_count")
        .ilike("id", certId)
        .single();

      const newCount = (data?.email_count || 0) + 1;

      await supabase
        .from("certificates")
        .update({
          email_sent: true,
          email_sent_at: now,
          email_count: newCount,
          last_sent_by: triggeredBy,
        })
        .ilike("id", certId);
    } catch (err) {
      console.error("Error updating email status in Supabase:", err);
    }
  }
}
