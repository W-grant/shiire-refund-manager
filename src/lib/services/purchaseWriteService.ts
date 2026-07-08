import { legacyRecordToPurchaseInsert, legacyRecordToPurchaseUpdate, type LegacyClassification, type LegacyImage, type LegacyRecord } from "../mappers/purchaseMapper";
import { deletePurchaseEvidenceByIds, fetchPurchaseEvidenceByPurchaseId } from "../repositories/evidenceRepository";
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

export type PurchaseUpdateResult = {
  purchase: { id: string };
  evidence: EvidenceUploadResult;
  removedEvidenceCount: number;
};

export type LegacyImageBundle = {
  id: string;
  images: LegacyImage[];
  removedEvidenceIds?: string[];
  removedStoragePaths?: string[];
};

export type PurchaseMigrationResult = {
  inserted: number;
  skipped: number;
  failed: number;
  evidenceUploaded: number;
  evidenceFailed: number;
  errors: Array<{ id: string; message: string }>;
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

function isDuplicateKeyError(error: unknown) {
  return (error as SupabaseWriteError).code === "23505";
}

export async function migratePurchases(
  records: LegacyRecord[],
  imageBundles: LegacyImageBundle[],
  classifyRecord: (record: LegacyRecord) => LegacyClassification
): Promise<PurchaseMigrationResult> {
  console.log("[Migration] Start", { count: records.length });
  const status = await getPurchaseSaveStatus();
  if (!status.authenticated || !status.canInsert) {
    throw new Error("Supabase login with admin or staff role is required to migrate purchases");
  }

  const imagesById = new Map(imageBundles.map((bundle) => [bundle.id, bundle.images || []]));
  const result: PurchaseMigrationResult = {
    inserted: 0,
    skipped: 0,
    failed: 0,
    evidenceUploaded: 0,
    evidenceFailed: 0,
    errors: []
  };

  for (const record of records) {
    try {
      const images = imagesById.get(record.id) || [];
      const saveResult = await savePurchase(record, classifyRecord(record), images);
      result.inserted += 1;
      result.evidenceUploaded += saveResult.evidence.successes.length;
      result.evidenceFailed += saveResult.evidence.failures.length;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        console.info("[Migration] Skipped existing purchase", { id: record.id });
        result.skipped += 1;
        continue;
      }
      console.error("[Migration] Failed purchase", {
        id: record.id,
        message: (error as SupabaseWriteError).message
      });
      result.failed += 1;
      result.errors.push({
        id: record.id,
        message: (error as SupabaseWriteError).message || String(error)
      });
    }
  }

  console.log("[Migration] Complete", result);
  return result;
}

export async function updatePurchase(
  record: LegacyRecord,
  classification: LegacyClassification,
  images: LegacyImage[] = [],
  removedEvidence: { removedEvidenceIds?: string[]; removedStoragePaths?: string[] } = {}
): Promise<PurchaseUpdateResult> {
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
    const existingEvidence = await fetchPurchaseEvidenceByPurchaseId(record.id);
    const retainedImages = images.filter((image) => !String(image.full || "").startsWith("data:"));
    const newImages = images.filter((image) => String(image.full || "").startsWith("data:"));
    const retainedIds = new Set(retainedImages.map((image) => image.evidenceId).filter(Boolean));
    const retainedPaths = new Set(retainedImages.map((image) => image.storagePath).filter(Boolean));
    const explicitRemovedIds = new Set((removedEvidence.removedEvidenceIds || []).filter(Boolean));
    const explicitRemovedPaths = new Set((removedEvidence.removedStoragePaths || []).filter(Boolean));
    let removedEvidenceCount = 0;

    const removedEvidenceIds = existingEvidence
      .filter((row) => {
        if (explicitRemovedIds.has(row.id) || explicitRemovedPaths.has(row.storage_path)) return true;
        return !retainedIds.has(row.id) && !retainedPaths.has(row.storage_path);
      })
      .map((row) => row.id);
    if (removedEvidenceIds.length) {
      const removedRows = await deletePurchaseEvidenceByIds(removedEvidenceIds);
      removedEvidenceCount = removedRows.length;
      console.log("[Storage] Evidence metadata delete success", { id: record.id, count: removedEvidenceCount });
    }

    const evidence = newImages.length
      ? await uploadEvidenceImages(
          record,
          newImages,
          sessionResult.data.session?.user.id || null,
          retainedImages.length
        )
      : { successes: [], failures: [] };
    if (evidence.failures.length) {
      console.warn("[Storage] Evidence update completed with warnings", {
        id: record.id,
        successCount: evidence.successes.length,
        failureCount: evidence.failures.length
      });
    }
    return { purchase, evidence, removedEvidenceCount };
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
