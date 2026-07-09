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
  const secret = env.SHARED_SECRET || env.SHEETS_SYNC_SECRET || env.SYNC_SECRET;
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
      googleSheetsConfigured: Boolean(env.GOOGLE_SHEETS_WEBAPP_URL),
      authRequired: Boolean(env.SHARED_SECRET || env.SHEETS_SYNC_SECRET || env.SYNC_SECRET)
    }, 200, cors);
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, cors);
  }

  if (!isAuthorized(request, env)) {
    return json({ error: "unauthorized" }, 401, cors);
  }

  if (!env.GOOGLE_SHEETS_WEBAPP_URL) {
    return json({ error: "missing_google_sheets_webapp_url" }, 500, cors);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "invalid_json", message: error.message }, 400, cors);
  }

  if (!["purchases", "sales", "all"].includes(payload.type)) {
    return json({ error: "invalid_type" }, 400, cors);
  }

  try {
    const response = await fetch(env.GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        secret: env.SHEETS_SYNC_SECRET || env.SHARED_SECRET || env.SYNC_SECRET || ""
      })
    });
    const text = await response.text();
    return new Response(text || "{}", {
      status: response.status,
      headers: {
        ...cors,
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return json({ error: "google_sheets_request_failed", message: error.message }, 502, cors);
  }
}
