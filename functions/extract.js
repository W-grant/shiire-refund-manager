const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 4096;

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("origin") || "";
  const origin = env.ALLOWED_ORIGIN || requestOrigin || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function isAuthorized(request, env) {
  const secret = env.SHARED_SECRET || env.SYNC_SECRET;
  if (!secret) return true;
  return request.headers.get("x-app-secret") === secret;
}

export async function onRequest(context) {
  const { request, env } = context;
  const cors = corsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: cors });
  }

  if (request.method === "GET") {
    return json({
      ok: true,
      anthropicConfigured: Boolean(env.ANTHROPIC_API_KEY),
      authRequired: Boolean(env.SHARED_SECRET || env.SYNC_SECRET)
    }, 200, cors);
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, cors);
  }

  if (!isAuthorized(request, env)) {
    return json({ error: "unauthorized" }, 401, cors);
  }

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "missing_anthropic_api_key" }, 500, cors);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "invalid_json", message: error.message }, 400, cors);
  }

  if (!Array.isArray(payload.messages)) {
    return json({ error: "messages_required" }, 400, cors);
  }

  const upstreamPayload = {
    model: payload.model || DEFAULT_MODEL,
    max_tokens: Number(payload.max_tokens || DEFAULT_MAX_TOKENS),
    messages: payload.messages
  };

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json"
      },
      body: JSON.stringify(upstreamPayload)
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return json({ error: "anthropic_request_failed", message: error.message }, 502, cors);
  }
}
