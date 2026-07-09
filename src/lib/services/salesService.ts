import { fetchSales, insertSale, markSaleDeleted, updateSale, type SaleDestination, type SaleRow, type SaleStatus } from "../repositories/salesRepository";
import { supabase } from "../supabase";

export type SaleFormInput = {
  id?: string;
  purchaseId: string;
  destination: SaleDestination;
  status: SaleStatus;
  listingId?: string;
  sku?: string;
  listedAt?: string;
  soldAt?: string;
  salePrice?: number;
  currency?: string;
  exchangeRate?: number;
  platformFee?: number;
  paymentFee?: number;
  domesticShippingFee?: number;
  internationalShippingFee?: number;
  otherFee?: number;
  buyerCountry?: string;
  memo?: string;
};

type Role = "admin" | "staff" | "tax_accountant";

async function getWriteContext() {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const userId = sessionResult.data.session?.user.id;
  if (!userId) throw new Error("ログインが必要です");

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error) throw error;

  const role = data?.role as Role | undefined;
  if (role !== "admin" && role !== "staff") {
    throw new Error("販売情報の保存には管理者またはスタッフ権限が必要です");
  }
  return { userId, role };
}

function numberValue(value: number | undefined) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function optionalText(value: string | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalDate(value: string | undefined) {
  const text = String(value || "").trim();
  return text || null;
}

function salePriceJpy(input: SaleFormInput) {
  const price = numberValue(input.salePrice);
  const currency = String(input.currency || "JPY").toUpperCase();
  const exchangeRate = Number(input.exchangeRate || 0);
  if (currency === "JPY") return price;
  if (Number.isFinite(exchangeRate) && exchangeRate > 0) {
    return Math.round(price * exchangeRate);
  }
  return null;
}

function buildSaleRow(input: SaleFormInput, userId: string) {
  return {
    purchase_id: input.purchaseId,
    destination: input.destination || "other",
    status: input.status || "not_listed",
    listing_id: optionalText(input.listingId),
    sku: optionalText(input.sku),
    listed_at: optionalDate(input.listedAt),
    sold_at: optionalDate(input.soldAt),
    sale_price: numberValue(input.salePrice),
    currency: String(input.currency || "JPY").toUpperCase(),
    exchange_rate: input.currency && input.currency !== "JPY" ? Number(input.exchangeRate || 0) || null : null,
    sale_price_jpy: salePriceJpy(input),
    platform_fee: numberValue(input.platformFee),
    payment_fee: numberValue(input.paymentFee),
    domestic_shipping_fee: numberValue(input.domesticShippingFee),
    international_shipping_fee: numberValue(input.internationalShippingFee),
    other_fee: numberValue(input.otherFee),
    buyer_country: optionalText(input.buyerCountry),
    memo: optionalText(input.memo),
    updated_by: userId
  };
}

export async function listSales(): Promise<SaleRow[]> {
  return fetchSales();
}

export async function saveSale(input: SaleFormInput) {
  const { userId } = await getWriteContext();
  if (!input.purchaseId) throw new Error("仕入商品を選択してください");
  const row = buildSaleRow(input, userId);
  if (input.id) return updateSale(input.id, row);
  return insertSale({ ...row, created_by: userId });
}

export async function deleteSale(id: string) {
  const { userId, role } = await getWriteContext();
  if (role !== "admin") throw new Error("販売情報の削除には管理者権限が必要です");
  return markSaleDeleted(id, userId);
}
