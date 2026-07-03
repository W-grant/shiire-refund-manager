import { supabase } from "../supabase";

export type MasterRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

function orderBySort<T extends MasterRow>(rows: T[] | null) {
  return (rows || []).filter((row) => row.is_active).sort((a, b) => a.sort_order - b.sort_order);
}

export async function fetchBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("id,name,sort_order,is_active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return orderBySort(data as MasterRow[] | null);
}

export async function fetchChannels() {
  const { data, error } = await supabase
    .from("channels")
    .select("id,name,sort_order,is_active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return orderBySort(data as MasterRow[] | null);
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,sort_order,is_active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return orderBySort(data as MasterRow[] | null);
}
