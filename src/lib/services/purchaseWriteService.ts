import { legacyRecordToPurchaseInsert, type LegacyClassification, type LegacyRecord } from "../mappers/purchaseMapper";
import { fetchBranches, fetchCategories, fetchChannels } from "../repositories/masterRepository";
import { insertPurchase } from "../repositories/purchaseRepository";
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

export async function savePurchase(record: LegacyRecord, classification: LegacyClassification) {
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
    const result = await insertPurchase(row);
    console.log("[Save] Insert success", result);
    return result;
  } catch (error) {
    logInsertFailure(error as SupabaseWriteError);
    throw error;
  }
}

export const insertSupabasePurchase = savePurchase;
