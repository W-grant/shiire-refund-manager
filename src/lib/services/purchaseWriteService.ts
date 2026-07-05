import { legacyRecordToPurchaseInsert, legacyRecordToPurchaseUpdate, type LegacyClassification, type LegacyImage, type LegacyRecord } from "../mappers/purchaseMapper";
import { fetchBranches, fetchCategories, fetchChannels } from "../repositories/masterRepository";
import { insertPurchase, markPurchaseDeleted, updatePurchase as updatePurchaseRow } from "../repositories/purchaseRepository";
import { uploadEvidenceImages, type EvidenceUploadResult } from "../repositories/storageRepository";
import { supabase } from "../supabase";

type SupabaseWriteError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type PurchaseSaveStatus = {
  authenticated: boolean;
  canInsert: boolean;
  role: string | null;
};

export type PurchaseSaveResult = {
  purchase: { id: string };
  evidence: EvidenceUploadResult;
};

function logInsertFailure(error: SupabaseWriteError) {
  console.error("[Save] Insert failed", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint
  });
}

export async function getPurchaseSaveStatus(): Promise<PurchaseSaveStatus> {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const userId = sessionResult.data.session?.user.id;
  if (!userId) {
    return { authenticated: false, canInsert: false, role: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error) throw error;

  const role = data?.role || null;
  return {
    authenticated: true,
    canInsert: role === "admin" || role === "staff",
    role
  };
}

export async function savePurchase(
  record: LegacyRecord,
  classification: LegacyClassification,
  images: LegacyImage[] = []
): Promise<PurchaseSaveResult> {
  console.log("[Save] Start", { id: record.id });
  try {
    const [branches, channels, categories, sessionResult] = await Promise.all([
      fetchBranches(),
      fetchChannels(),
      fetchCategories(),
      supabase.auth.getSession()
    ]);
    if (sessionResult.error) throw sessionResult.error;

    const row = legacyRecordToPurchaseInsert(
      record,
      classification,
      { branches, channels, categories },
      sessionResult.data.session?.user.id || null
    );
    console.log("[Save] Before insert", { id: row.id });
    const purchase = await insertPurchase(row);
    console.log("[Save] Insert success", purchase);
    const evidence = images.length
      ? await uploadEvidenceImages(record, images, sessionResult.data.session?.user.id || null)
      : { successes: [], failures: [] };
    if (evidence.failures.length) {
      console.warn("[Storage] Evidence upload completed with warnings", {
        id: record.id,
        successCount: evidence.successes.length,
        failureCount: evidence.failures.length
      });
    }
    return { purchase, evidence };
  } catch (error) {
    logInsertFailure(error as SupabaseWriteError);
    throw error;
  }
}

export const insertSupabasePurchase = savePurchase;

export async function updatePurchase(
  record: LegacyRecord,
  classification: LegacyClassification
) {
  console.log("[Save] Update start", { id: record.id });
  try {
    const [branches, channels, categories, sessionResult] = await Promise.all([
      fetchBranches(),
      fetchChannels(),
      fetchCategories(),
      supabase.auth.getSession()
    ]);
    if (sessionResult.error) throw sessionResult.error;

    const row = legacyRecordToPurchaseUpdate(
      record,
      classification,
      { branches, channels, categories },
      sessionResult.data.session?.user.id || null
    );
    console.log("[Save] Before update", { id: record.id });
    const purchase = await updatePurchaseRow(record.id, row);
    console.log("[Save] Update success", purchase);
    return purchase;
  } catch (error) {
    console.error("[Save] Update failed", {
      message: (error as SupabaseWriteError).message,
      code: (error as SupabaseWriteError).code,
      details: (error as SupabaseWriteError).details,
      hint: (error as SupabaseWriteError).hint
    });
    throw error;
  }
}

export async function deletePurchase(id: string) {
  console.log("[Delete] Start", { id });
  try {
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) throw sessionResult.error;
    const userId = sessionResult.data.session?.user.id;
    if (!userId) {
      throw new Error("Supabase login is required to delete purchases");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    if (profile?.role !== "admin") {
      throw new Error("Admin role is required to delete purchases");
    }

    console.log("[Delete] Before soft delete", { id });
    const purchase = await markPurchaseDeleted(id, userId);
    console.log("[Delete] Soft delete success", purchase);
    return purchase;
  } catch (error) {
    console.error("[Delete] Soft delete failed", {
      message: (error as SupabaseWriteError).message,
      code: (error as SupabaseWriteError).code,
      details: (error as SupabaseWriteError).details,
      hint: (error as SupabaseWriteError).hint
    });
    throw error;
  }
}
