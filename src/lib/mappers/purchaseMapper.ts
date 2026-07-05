import type { EvidenceWithUrl } from "../repositories/evidenceRepository";
import type { MasterRow } from "../repositories/masterRepository";
import type { PurchaseInsert, PurchaseRow, PurchaseUpdate } from "../repositories/purchaseRepository";

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
  evidenceId?: string;
  storageBucket?: string;
  storagePath?: string;
};

export type LegacyImageBundle = {
  id: string;
  images: LegacyImage[];
};

export type LegacyClassification = {
  kind?: string;
  ratio?: number;
  tax?: number;
  note?: string;
};

export type MasterLookup = {
  branches: MasterRow[];
  channels: MasterRow[];
  categories: MasterRow[];
};

export function masterNames(rows: MasterRow[]) {
  return rows.map((row) => row.name);
}

function byName(rows: MasterRow[], name: string | null | undefined, label: string) {
  const value = String(name || "").trim();
  if (!value) return null;
  const row = rows.find((item) => item.name === value || item.name.trim() === value);
  if (!row) throw new Error(`${label} not found: ${value}`);
  return row.id;
}

function optionalText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

export function legacyRecordToPurchaseInsert(
  record: LegacyRecord,
  classification: LegacyClassification,
  masters: MasterLookup,
  userId: string | null
): PurchaseInsert {
  return {
    id: record.id,
    purchase_date: record.date,
    branch_id: byName(masters.branches, record.branch, "branch"),
    channel_id: byName(masters.channels, record.channel, "channel"),
    category_id: byName(masters.categories, record.category, "category"),
    staff_id: null,
    name: record.name,
    quantity: Number(record.qty || 1),
    amount: Number(record.amount || 0),
    tax_rate: Number(record.rate || 10),
    kind: record.kind,
    stock: record.stock,
    qualified: record.qualified,
    transaction_type: record.anon,
    seller_name: optionalText(record.seller),
    seller_address: optionalText(record.address),
    memo: optionalText(record.memo),
    deduction_kind: classification.kind || null,
    deduction_ratio: typeof classification.ratio === "number" ? classification.ratio : null,
    deduction_tax: typeof classification.tax === "number" ? classification.tax : null,
    classification_note: classification.note || null,
    created_by: userId,
    updated_by: userId
  };
}

export function legacyRecordToPurchaseUpdate(
  record: LegacyRecord,
  classification: LegacyClassification,
  masters: MasterLookup,
  userId: string | null
): PurchaseUpdate {
  const { id, created_by, ...row } = legacyRecordToPurchaseInsert(record, classification, masters, userId);
  void id;
  void created_by;
  return row;
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
      label: row.label || undefined,
      evidenceId: row.id,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path
    });
    bundles.set(row.purchase_id, bundle);
  });
  return [...bundles.values()];
}
