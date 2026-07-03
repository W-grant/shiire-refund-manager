import type { EvidenceWithUrl } from "../repositories/evidenceRepository";
import type { MasterRow } from "../repositories/masterRepository";
import type { PurchaseRow } from "../repositories/purchaseRepository";

export type LegacyRecord = {
  id: string;
  date: string;
  channel: string;
  staff: string;
  name: string;
  category: string;
  qty: number;
  branch: string;
  amount: number;
  kind: "kobutsu" | "jun" | "other";
  stock: "yes" | "no";
  qualified: "yes" | "no" | "unknown";
  rate: number;
  anon: "anon" | "named";
  seller: string;
  address: string;
  memo: string;
  hasImage: boolean;
  updatedAt: string;
};

export type LegacyImage = {
  full: string;
  thumb: string;
  fileName: string;
  label?: string;
};

export type LegacyImageBundle = {
  id: string;
  images: LegacyImage[];
};

export function masterNames(rows: MasterRow[]) {
  return rows.map((row) => row.name);
}

export function purchasesToLegacyRecords(rows: PurchaseRow[], evidenceRows: EvidenceWithUrl[]) {
  const evidenceByPurchase = new Map<string, EvidenceWithUrl[]>();
  evidenceRows.forEach((row) => {
    const current = evidenceByPurchase.get(row.purchase_id) || [];
    current.push(row);
    evidenceByPurchase.set(row.purchase_id, current);
  });

  return rows.map((row) => purchaseToLegacyRecord(row, evidenceByPurchase.get(row.id) || []));
}

export function purchaseToLegacyRecord(row: PurchaseRow, evidenceRows: EvidenceWithUrl[]): LegacyRecord {
  return {
    id: row.id,
    date: row.purchase_date,
    channel: row.channel?.name || "",
    staff: row.staff?.display_name || "未設定",
    name: row.name,
    category: row.category?.name || "",
    qty: Number(row.quantity || 1),
    branch: row.branch?.name || "",
    amount: Number(row.amount || 0),
    kind: row.kind,
    stock: row.stock,
    qualified: row.qualified,
    rate: Number(row.tax_rate || 10),
    anon: row.transaction_type,
    seller: row.seller_name || "",
    address: row.seller_address || "",
    memo: row.memo || "",
    hasImage: evidenceRows.length > 0,
    updatedAt: row.updated_at
  };
}

export function evidenceToLegacyImageBundles(rows: EvidenceWithUrl[]) {
  const bundles = new Map<string, LegacyImageBundle>();
  rows.forEach((row) => {
    const bundle = bundles.get(row.purchase_id) || { id: row.purchase_id, images: [] };
    bundle.images.push({
      full: row.url,
      thumb: row.url,
      fileName: row.file_name,
      label: row.label || undefined
    });
    bundles.set(row.purchase_id, bundle);
  });
  return [...bundles.values()];
}
