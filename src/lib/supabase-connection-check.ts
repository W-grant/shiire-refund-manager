type SupabaseConnectionEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = (import.meta as ImportMeta & { env: SupabaseConnectionEnv }).env;

console.log("[Supabase] env check", {
  url: env.VITE_SUPABASE_URL ? "設定済み" : "未設定",
  key: env.VITE_SUPABASE_ANON_KEY ? "設定済み" : "未設定",
  urlLength: env.VITE_SUPABASE_URL?.length ?? 0,
  keyLength: env.VITE_SUPABASE_ANON_KEY?.length ?? 0
});

async function checkSupabaseConnection() {
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("branches")
      .select("id,name,sort_order,is_active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] branches connection check failed", {
        message: error.message,
        status: "status" in error ? error.status : undefined,
        error
      });
      return;
    }

    console.log("[Supabase] branches connection check", data);
  } catch (error) {
    console.error("[Supabase] branches connection check failed", {
      message: error instanceof Error ? error.message : String(error),
      status: error && typeof error === "object" && "status" in error ? error.status : undefined,
      error
    });
  }
}

void checkSupabaseConnection();
