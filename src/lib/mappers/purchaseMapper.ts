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
  destination?: string;
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
  managementNumber?: string;
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

const MASTER_ALIASES: Record<string, Array<[string, string]>> = {
  channel: [
    ["市場", "市場（古物市場）"],
    ["古物市場", "市場（古物市場）"],
    ["オークション", "業者オークション"]
  ],
  category: [
    ["財布", "バッグ"],
    ["ジュエリー", "貴金属・宝飾"],
    ["宝飾", "貴金属・宝飾"],
    ["アクセサリー", "貴金属・宝飾"],
    ["レンズ", "カメラ"]
  ]
};

function normalizedText(value: unknown) {
  return String(value || "").normalize("NFKC").trim().toLowerCase();
}

function byName(rows: MasterRow[], name: string | null | undefined, label: string) {
  const value = String(name || "").trim();
  if (!value) return null;
  const normalizedValue = normalizedText(value);
  const exact = rows.find((item) => normalizedText(item.name) === normalizedValue);
  if (exact) return exact.id;

  const alias = (MASTER_ALIASES[label] || []).find(([keyword]) => normalizedValue.includes(normalizedText(keyword)));
  if (alias) {
    const aliasRow = rows.find((item) => normalizedText(item.name) === normalizedText(alias[1]));
    if (aliasRow) return aliasRow.id;
  }

  const partial = rows.find((item) => {
    const rowName = normalizedText(item.name);
    return rowName && (normalizedValue.includes(rowName) || rowName.includes(normalizedValue));
  });
  if (partial) return partial.id;

  const fallback = rows.find((item) => item.name === "その他");
  console.warn("[Save] Master not found; falling back", { label, value, fallback: fallback?.name || null });
  return fallback?.id || null;
}

function optionalText(value: string | null | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

export function normalizePurchaseDate(value: string | null | undefined) {
  const text = String(value || "").trim();
  const normalized = text.replace(/[./]/g, "-").replace(/年|月/g, "-").replace(/日/g, "");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return text;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function purchaseDateForSave(value: string | null | undefined) {
  const normalized = normalizePurchaseDate(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : new Date().toISOString().slice(0, 10);
}

function destinationForSave(value: unknown): PurchaseInsert["destination"] {
  const text = normalizedText(value);
  if (!text || text === "未定" || text === "未設定") return "undecided";
  if (text.includes("catawiki")) return "catawiki";
  if (text.includes("ebay") || text.includes("e-bay")) return "ebay";
  if (text.includes("海外") || text.includes("overseas") || text.includes("oversea")) return "overseas";
  if (text.includes("ヤフオク") || text.includes("yahoo")) return "yahoo";
  if (text.includes("市場") || text.includes("market")) return "market";
  if (text.includes("共通") || text.includes("both")) return "both";
  return "other";
}

function kindForSave(value: unknown): PurchaseInsert["kind"] {
  const text = normalizedText(value);
  if (text === "jun" || text.includes("準")) return "jun";
  if (text === "other" || text.includes("その他")) return "other";
  return "kobutsu";
}

function stockForSave(value: unknown): PurchaseInsert["stock"] {
  const text = normalizedText(value);
  return text === "no" || text.includes("いいえ") || text.includes("なし") ? "no" : "yes";
}

function qualifiedForSave(value: unknown): PurchaseInsert["qualified"] {
  const text = normalizedText(value);
  if (text === "yes" || text.includes("あり") || text.includes("登録")) return "yes";
  if (text === "no" || text.includes("なし")) return "no";
  return "unknown";
}

function transactionTypeForSave(value: unknown): PurchaseInsert["transaction_type"] {
  const text = normalizedText(value);
  return text === "named" || text.includes("記名") || text.includes("本名") ? "named" : "anon";
}

function taxRateForSave(value: unknown) {
  return Number(value) === 8 ? 8 : 10;
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
    purchase_date: purchaseDateForSave(record.date),
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
    destination: destinationForSave(record.destination),
    tax_rate: taxRateForSave(record.rate),
    kind: kindForSave(record.kind),
    stock: stockForSave(record.stock),
    qualified: qualifiedForSave(record.qualified),
    transaction_type: transactionTypeForSave(record.anon),
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
