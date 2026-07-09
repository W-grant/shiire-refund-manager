import { supabase } from "../supabase";

export type SaleStatus = "not_listed" | "preparing" | "listed" | "sold" | "cancelled" | "returned" | "on_hold";
export type SaleDestination = "catawiki" | "ebay" | "other";

export type SaleRow = {
  id: string;
  purchase_id: string;
  destination: SaleDestination;
  status: SaleStatus;
  listing_id: string | null;
  sku: string | null;
  listed_at: string | null;
  sold_at: string | null;
  sale_price: number;
  currency: string;
  exchange_rate: number | null;
  sale_price_jpy: number | null;
  platform_fee: number;
  payment_fee: number;
  domestic_shipping_fee: number;
  international_shipping_fee: number;
  other_fee: number;
  buyer_country: string | null;
  memo: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SaleInsert = Omit<SaleRow, "id" | "created_at" | "updated_at" | "deleted_at"> & {
  id?: string;
};

export type SaleUpdate = Partial<Omit<SaleInsert, "purchase_id" | "created_by">>;

export async function fetchSales() {
  const { data, error } = await supabase
    .from("sales")
    .select(`
      id,
      purchase_id,
      destination,
      status,
      listing_id,
      sku,
      listed_at,
      sold_at,
      sale_price,
      currency,
      exchange_rate,
      sale_price_jpy,
      platform_fee,
      payment_fee,
      domestic_shipping_fee,
      international_shipping_fee,
      other_fee,
      buyer_country,
      memo,
      created_by,
      updated_by,
      created_at,
      updated_at,
      deleted_at
    `)
    .is("deleted_at", null)
    .order("sold_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SaleRow[];
}

export async function insertSale(row: SaleInsert) {
  const { data, error } = await supabase
    .from("sales")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateSale(id: string, row: SaleUpdate) {
  const { data, error } = await supabase
    .from("sales")
    .update(row)
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function markSaleDeleted(id: string, userId: string) {
  const { data, error } = await supabase
    .from("sales")
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userId
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
