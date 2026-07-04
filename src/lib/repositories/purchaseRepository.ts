import { supabase } from "../supabase";

export type PurchaseRow = {
  id: string;
  purchase_date: string;
  branch_id: string | null;
  channel_id: string | null;
  category_id: string | null;
  staff_id: string | null;
  name: string;
  quantity: number;
  amount: number;
  tax_rate: number;
  kind: "kobutsu" | "jun" | "other";
  stock: "yes" | "no";
  qualified: "yes" | "no" | "unknown";
  transaction_type: "anon" | "named";
  seller_name: string | null;
  seller_address: string | null;
  memo: string | null;
  deduction_kind: string | null;
  deduction_ratio: number | null;
  deduction_tax: number | null;
  classification_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  branch?: { name: string } | null;
  channel?: { name: string } | null;
  category?: { name: string } | null;
  staff?: { display_name: string } | null;
};

export type PurchaseInsert = {
  id: string;
  purchase_date: string;
  branch_id: string | null;
  channel_id: string | null;
  category_id: string | null;
  staff_id: string | null;
  name: string;
  quantity: number;
  amount: number;
  tax_rate: number;
  kind: "kobutsu" | "jun" | "other";
  stock: "yes" | "no";
  qualified: "yes" | "no" | "unknown";
  transaction_type: "anon" | "named";
  seller_name: string | null;
  seller_address: string | null;
  memo: string | null;
  deduction_kind: string | null;
  deduction_ratio: number | null;
  deduction_tax: number | null;
  classification_note: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

export async function fetchPurchases() {
  const { data, error } = await supabase
    .from("purchases")
    .select(`
      id,
      purchase_date,
      branch_id,
      channel_id,
      category_id,
      staff_id,
      name,
      quantity,
      amount,
      tax_rate,
      kind,
      stock,
      qualified,
      transaction_type,
      seller_name,
      seller_address,
      memo,
      deduction_kind,
      deduction_ratio,
      deduction_tax,
      classification_note,
      created_at,
      updated_at,
      deleted_at,
      branch:branches(name),
      channel:channels(name),
      category:categories(name),
      staff:profiles!purchases_staff_id_fkey(display_name)
    `)
    .is("deleted_at", null)
    .order("purchase_date", { ascending: false });
  if (error) throw error;
  return (data || []) as PurchaseRow[];
}

export async function insertPurchase(row: PurchaseInsert) {
  const { data, error } = await supabase
    .from("purchases")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
