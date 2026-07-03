import { attachEvidenceUrls, fetchPurchaseEvidence } from "../repositories/evidenceRepository";
import { fetchBranches, fetchCategories, fetchChannels } from "../repositories/masterRepository";
import { fetchPurchases } from "../repositories/purchaseRepository";
import { evidenceToLegacyImageBundles, masterNames, purchasesToLegacyRecords } from "../mappers/purchaseMapper";

export async function loadSupabasePurchaseState() {
  const [branches, channels, categories, purchases, evidence] = await Promise.all([
    fetchBranches(),
    fetchChannels(),
    fetchCategories(),
    fetchPurchases(),
    fetchPurchaseEvidence()
  ]);
  const evidenceWithUrls = await attachEvidenceUrls(evidence);

  return {
    meta: {
      branches: masterNames(branches),
      channels: masterNames(channels),
      categories: masterNames(categories)
    },
    records: purchasesToLegacyRecords(purchases, evidenceWithUrls),
    images: evidenceToLegacyImageBundles(evidenceWithUrls)
  };
}

export type SupabasePurchaseState = Awaited<ReturnType<typeof loadSupabasePurchaseState>>;
