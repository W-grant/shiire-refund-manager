async function checkSupabaseConnection() {
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("branches")
      .select("id,name,sort_order,is_active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] branches connection check failed", error);
      return;
    }

    console.log("[Supabase] branches connection check", data);
  } catch (error) {
    console.error("[Supabase] branches connection check failed", error);
  }
}

void checkSupabaseConnection();
