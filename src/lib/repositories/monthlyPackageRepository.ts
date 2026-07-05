import { supabase } from "../supabase";

const TAX_PACKAGES_BUCKET = "tax-packages";

export type MonthlyPackageInsert = {
  target_month: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  purchase_count: number;
  total_amount: number;
  total_deduction_tax: number;
  generated_by: string | null;
};

export type MonthlyPackageRow = {
  id: string;
  target_month: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  purchase_count: number;
  total_amount: number;
  total_deduction_tax: number;
  generated_at: string;
  generated_by: string | null;
};

function sanitizePathPart(value: string, fallback: string) {
  const safe = String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || fallback;
}

export function monthlyPackageStoragePath(month: string, fileName: string) {
  const [year = "unknown", rawMonth = "unknown"] = String(month || "").split("-");
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const safeName = sanitizePathPart(fileName, "tax-package.zip");
  return `monthly/${year}/${rawMonth}/${timestamp}_${safeName}`;
}

export async function uploadMonthlyPackage(blob: Blob, storagePath: string) {
  const { error } = await supabase.storage
    .from(TAX_PACKAGES_BUCKET)
    .upload(storagePath, blob, { contentType: "application/zip", upsert: false });
  if (error) throw error;
  return { storageBucket: TAX_PACKAGES_BUCKET, storagePath };
}

export async function insertMonthlyPackage(row: MonthlyPackageInsert) {
  const { data, error } = await supabase
    .from("monthly_packages")
    .insert(row)
    .select("id,storage_bucket,storage_path,file_name,target_month")
    .single();
  if (error) throw error;
  return data;
}

export async function fetchMonthlyPackages() {
  const { data, error } = await supabase
    .from("monthly_packages")
    .select("id,target_month,storage_bucket,storage_path,file_name,purchase_count,total_amount,total_deduction_tax,generated_at,generated_by")
    .order("generated_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as MonthlyPackageRow[];
}

export async function createMonthlyPackageSignedUrl(row: Pick<MonthlyPackageRow, "storage_bucket" | "storage_path">) {
  const { data, error } = await supabase.storage
    .from(row.storage_bucket)
    .createSignedUrl(row.storage_path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
