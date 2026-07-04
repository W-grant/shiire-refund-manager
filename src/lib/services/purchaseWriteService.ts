import { legacyRecordToPurchaseInsert, type LegacyClassification, type LegacyRecord } from "../mappers/purchaseMapper";
import { fetchBranches, fetchCategories, fetchChannels } from "../repositories/masterRepository";
import { insertPurchase } from "../repositories/purchaseRepository";
import { supabase } from "../supabase";

export async function insertSupabasePurchase(record: LegacyRecord, classification: LegacyClassification) {
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
  return insertPurchase(row);
}
