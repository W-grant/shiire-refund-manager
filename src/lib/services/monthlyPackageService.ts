import { createMonthlyPackageSignedUrl, fetchMonthlyPackages, insertMonthlyPackage, monthlyPackageStoragePath, uploadMonthlyPackage } from "../repositories/monthlyPackageRepository";
import { supabase } from "../supabase";

export type SaveMonthlyPackageInput = {
  month: string;
  fileName: string;
  blob: Blob;
  purchaseCount: number;
  totalAmount: number;
  totalDeductionTax: number;
};

export async function saveMonthlyPackage(input: SaveMonthlyPackageInput) {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const userId = sessionResult.data.session?.user.id;
  if (!userId) {
    throw new Error("Supabase login is required to save monthly packages");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if (!["admin", "staff"].includes(profile?.role)) {
    throw new Error("Admin or staff role is required to save monthly packages");
  }

  const storagePath = monthlyPackageStoragePath(input.month, input.fileName);
  console.log("[TaxPackage] Upload start", { month: input.month, storagePath });
  const uploaded = await uploadMonthlyPackage(input.blob, storagePath);
  console.log("[TaxPackage] Upload success", uploaded);

  const targetMonth = `${input.month}-01`;
  const metadata = await insertMonthlyPackage({
    target_month: targetMonth,
    storage_bucket: uploaded.storageBucket,
    storage_path: uploaded.storagePath,
    file_name: input.fileName,
    purchase_count: input.purchaseCount,
    total_amount: input.totalAmount,
    total_deduction_tax: input.totalDeductionTax,
    generated_by: userId
  });
  console.log("[TaxPackage] Metadata insert success", metadata);
  return metadata;
}

export async function listMonthlyPackages() {
  return fetchMonthlyPackages();
}

export async function getMonthlyPackageDownloadUrl(id: string) {
  const rows = await fetchMonthlyPackages();
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("Monthly package was not found");
  const url = await createMonthlyPackageSignedUrl(row);
  return { url, fileName: row.file_name };
}
