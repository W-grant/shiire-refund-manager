import type { EvidenceWithUrl } from "../repositories/evidenceRepository";
import type { MasterRow } from "../repositories/masterRepository";
import type { PurchaseInsert, PurchaseRow, PurchaseUpdate } from "../repositories/purchaseRepository";

export type LegacyRecord = {
  id: string;
  date: string;
  channel: string;
  staff: string;
  name: string;
  manufacturer?: string;
  category: string;
  qty: number;
  branch: string;
  itemPrice?: number;
  shippingFee?: number;
  purchaseFee?: number;
  purchaseFeeTax?: number;
  shippingFeeTotal?: number;
  amount: number;
  destination?: "catawiki" | "ebay" | "overseas" | "yahoo" | "market" | "both" | "undecided" | "other";
  kind: "kobutsu" | "jun" | "other";
  stock: "yes" | "no";
  qualified: "yes" | "no" | "unknown";
  invoiceRegistrationNumber?: string;
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
  mimeType?: string;
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

const COST_MEMO_MARKER = "shiire_cost_breakdown:";
const INVOICE_REGISTRATION_MEMO_MARKER = "shiire_invoice_registration:";
const STAFF_MEMO_MARKER = "shiire_staff:";
const MANAGEMENT_NUMBER_MEMO_MARKER = "shiire_management_number:";

function numberValue(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function costBreakdown(record: Partial<LegacyRecord>) {
  const shippingFee = numberValue(record.shippingFee);
  const purchaseFeeTax = numberValue(record.purchaseFeeTax);
  const oldTotal = numberValue(record.shippingFeeTotal);
  const hasBreakdown = Boolean(record.shippingFee || record.purchaseFee || record.purchaseFeeTax);
  const purchaseFee = numberValue(record.purchaseFee ?? (hasBreakdown ? 0 : oldTotal));
  const total = shippingFee + purchaseFee + purchaseFeeTax;
  return {
    shippingFee,
    purchaseFee,
    purchaseFeeTax,
    shippingFeeTotal: total > 0 ? total : oldTotal
  };
}

function normalizeInvoiceRegistrationNumber(value: unknown) {
  return String(value || "").toUpperCase().replace(/[^T0-9]/g, "").replace(/^([0-9])/, "T$1").slice(0, 14);
}

function normalizeStaffName(value: unknown) {
  const staff = String(value || "").trim();
  if (staff === "阿部さん") return "阿部";
  if (staff === "大石さん") return "大石";
  return staff;
}
function normalizeManagementNumber(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function splitMemoAndInvoiceRegistration(memo: string | null | undefined) {
  const text = String(memo || "");
  const markerIndex = text.indexOf(INVOICE_REGISTRATION_MEMO_MARKER);
  if (markerIndex < 0) return { memo: text, invoiceRegistrationNumber: "" };
  const cleanMemo = text.slice(0, markerIndex).trim();
  const raw = text.slice(markerIndex + INVOICE_REGISTRATION_MEMO_MARKER.length).trim().split(/\s+/)[0] || "";
  return { memo: cleanMemo, invoiceRegistrationNumber: normalizeInvoiceRegistrationNumber(raw) };
}

function memoWithInvoiceRegistration(memo: string | null | undefined, invoiceRegistrationNumber: string | null | undefined) {
  const cleanMemo = splitMemoAndInvoiceRegistration(memo).memo.trim();
  const normalized = normalizeInvoiceRegistrationNumber(invoiceRegistrationNumber);
  if (!normalized) return cleanMemo;
  return `${cleanMemo}${cleanMemo ? "\n" : ""}${INVOICE_REGISTRATION_MEMO_MARKER}${normalized}`;
}

function splitMemoAndStaff(memo: string | null | undefined) {
  const text = String(memo || "");
  const markerIndex = text.indexOf(STAFF_MEMO_MARKER);
  if (markerIndex < 0) return { memo: text, staff: "" };
  const cleanMemo = text.slice(0, markerIndex).trim();
  const staff = normalizeStaffName(text.slice(markerIndex + STAFF_MEMO_MARKER.length).trim().split(/\s+/)[0] || "");
  return { memo: cleanMemo, staff };
}

function memoWithStaff(memo: string | null | undefined, staff: string | null | undefined) {
  const cleanMemo = splitMemoAndStaff(memo).memo.trim();
  const normalized = normalizeStaffName(staff);
  if (!normalized || normalized === "未設定") return cleanMemo;
  return `${cleanMemo}${cleanMemo ? "\n" : ""}${STAFF_MEMO_MARKER}${normalized}`;
}
function splitMemoAndManagementNumber(memo: string | null | undefined) {
  const text = String(memo || "");
  const markerIndex = text.indexOf(MANAGEMENT_NUMBER_MEMO_MARKER);
  if (markerIndex < 0) return { memo: text, managementNumber: "" };
  const cleanMemo = text.slice(0, markerIndex).trim();
  const managementNumber = normalizeManagementNumber(text.slice(markerIndex + MANAGEMENT_NUMBER_MEMO_MARKER.length).trim().split(/\s+/)[0] || "");
  return { memo: cleanMemo, managementNumber };
}

function memoWithManagementNumber(memo: string | null | undefined, managementNumber: string | null | undefined) {
  const cleanMemo = splitMemoAndManagementNumber(memo).memo.trim();
  const normalized = normalizeManagementNumber(managementNumber);
  if (!normalized) return cleanMemo;
  return `${cleanMemo}${cleanMemo ? "\n" : ""}${MANAGEMENT_NUMBER_MEMO_MARKER}${normalized}`;
}

function memoWithCostBreakdown(memo: string | null | undefined, record: LegacyRecord) {
  const cleanMemo = String(memo || "").replace(new RegExp(`\\n?${COST_MEMO_MARKER}.*$`, "s"), "").trim();
  const costs = costBreakdown(record);
  if (!costs.shippingFee && !costs.purchaseFee && !costs.purchaseFeeTax) return cleanMemo;
  return `${cleanMemo}${cleanMemo ? "\n" : ""}${COST_MEMO_MARKER}${JSON.stringify(costs)}`;
}

function memoWithInternalMarkers(memo: string | null | undefined, record: LegacyRecord) {
  return memoWithCostBreakdown(memoWithStaff(memoWithManagementNumber(memoWithInvoiceRegistration(memo, record.invoiceRegistrationNumber), record.managementNumber), record.staff), record);
}

function splitMemoAndCosts(memo: string | null | undefined) {
  const text = String(memo || "");
  const markerIndex = text.indexOf(COST_MEMO_MARKER);
  if (markerIndex < 0) return { memo: text, costs: null };
  const cleanMemo = text.slice(0, markerIndex).trim();
  const raw = text.slice(markerIndex + COST_MEMO_MARKER.length).trim();
  try {
    return { memo: cleanMemo, costs: JSON.parse(raw) as Partial<LegacyRecord> };
  } catch {
    return { memo: cleanMemo, costs: null };
  }
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
    manufacturer: optionalText(record.manufacturer),
    quantity: Number(record.qty || 1),
    item_price: Number(record.itemPrice ?? record.amount ?? 0),
    shipping_fee_total: costBreakdown(record).shippingFeeTotal,
    amount: Number(record.amount || 0),
    destination: record.destination || "undecided",
    tax_rate: Number(record.rate || 10),
    kind: record.kind,
    stock: record.stock,
    qualified: record.qualified,
    transaction_type: record.anon,
    seller_name: optionalText(record.seller),
    seller_address: optionalText(record.address),
    memo: optionalText(memoWithInternalMarkers(record.memo, record)),
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
  const memoParts = splitMemoAndCosts(row.memo);
  const staffParts = splitMemoAndStaff(memoParts.memo);
  const managementParts = splitMemoAndManagementNumber(staffParts.memo);
  const invoiceParts = splitMemoAndInvoiceRegistration(managementParts.memo);
  const costs = costBreakdown({ shippingFeeTotal: Number(row.shipping_fee_total || 0), ...(memoParts.costs || {}) });
  return {
    id: row.id,
    date: row.purchase_date,
    channel: row.channel?.name || "",
    staff: normalizeStaffName(row.staff?.display_name || staffParts.staff || "未設定"),
    managementNumber: managementParts.managementNumber,
    name: row.name,
    manufacturer: row.manufacturer || "",
    category: row.category?.name || "",
    qty: Number(row.quantity || 1),
    branch: row.branch?.name || "",
    itemPrice: Number(row.item_price ?? row.amount ?? 0),
    shippingFee: costs.shippingFee,
    purchaseFee: costs.purchaseFee,
    purchaseFeeTax: costs.purchaseFeeTax,
    shippingFeeTotal: costs.shippingFeeTotal,
    amount: Number(row.amount || 0),
    destination: row.destination || "undecided",
    kind: row.kind,
    stock: row.stock,
    qualified: row.qualified,
    invoiceRegistrationNumber: invoiceParts.invoiceRegistrationNumber,
    rate: Number(row.tax_rate || 10),
    anon: row.transaction_type,
    seller: row.seller_name || "",
    address: row.seller_address || "",
    memo: invoiceParts.memo,
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
      mimeType: row.mime_type,
      label: row.label || undefined,
      evidenceId: row.id,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path
    });
    bundles.set(row.purchase_id, bundle);
  });
  return [...bundles.values()];
}
