import { supabase } from "../supabase";

export type EvidenceRow = {
  id: string;
  purchase_id: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  label: string | null;
  mime_type: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
};

export type EvidenceWithUrl = EvidenceRow & {
  url: string;
};

export async function fetchPurchaseEvidence() {
  const { data, error } = await supabase
    .from("purchase_evidence")
    .select("id,purchase_id,storage_bucket,storage_path,file_name,label,mime_type,file_size,sort_order,created_at")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as EvidenceRow[];
}

export async function attachEvidenceUrls(rows: EvidenceRow[]) {
  const withUrls = await Promise.all(
    rows.map(async (row) => {
      const { data, error } = await supabase.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, 60 * 60);
      return {
        ...row,
        url: error ? "" : data?.signedUrl || ""
      };
    })
  );
  return withUrls.filter((row) => row.url) as EvidenceWithUrl[];
}
