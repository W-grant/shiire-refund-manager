type SupabaseConnectionEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

const env = (import.meta as ImportMeta & { env: SupabaseConnectionEnv }).env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

function edge(value: string | undefined) {
  return {
    prefix: value ? value.slice(0, 8) : "",
    suffix: value ? value.slice(-8) : "",
    length: value?.length ?? 0
  };
}

console.log("[Supabase] env check", {
  url: supabaseUrl ? "設定済み" : "未設定",
  key: supabaseAnonKey ? "設定済み" : "未設定",
  urlPrefix: edge(supabaseUrl).prefix,
  urlSuffix: edge(supabaseUrl).suffix,
  urlLength: edge(supabaseUrl).length,
  keyPrefix: edge(supabaseAnonKey).prefix,
  keySuffix: edge(supabaseAnonKey).suffix,
  keyLength: edge(supabaseAnonKey).length
});

async function checkSupabaseJsConnection() {
  try {
    const { supabase } = await import("./supabase");
    const { data, error } = await supabase
      .from("branches")
      .select("id,name,sort_order,is_active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[Supabase] branches connection check failed (supabase-js)", {
        message: error.message,
        status: "status" in error ? error.status : undefined,
        error
      });
      return;
    }

    console.log("[Supabase] branches connection check (supabase-js)", data);
  } catch (error) {
    console.error("[Supabase] branches connection check failed (supabase-js)", {
      message: error instanceof Error ? error.message : String(error),
      status: error && typeof error === "object" && "status" in error ? error.status : undefined,
      error
    });
  }
}

async function checkFetchConnection() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Supabase] branches connection check failed (fetch)", {
        message: "Supabase URL or anon key is not set.",
        status: undefined
      });
      return;
    }

    const endpoint = new URL("/rest/v1/branches", supabaseUrl);
    endpoint.searchParams.set("select", "id,name,sort_order,is_active");
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });
    const text = await response.text();
    let body: unknown = text;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      console.error("[Supabase] branches connection check failed (fetch)", {
        message: typeof body === "object" && body && "message" in body ? body.message : response.statusText,
        status: response.status,
        error: body
      });
      return;
    }

    console.log("[Supabase] branches connection check (fetch)", body);
  } catch (error) {
    console.error("[Supabase] branches connection check failed (fetch)", {
      message: error instanceof Error ? error.message : String(error),
      status: error && typeof error === "object" && "status" in error ? error.status : undefined,
      error
    });
  }
}

void checkSupabaseJsConnection();
void checkFetchConnection();
