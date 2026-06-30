const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 4096;

function headerValue(event, name) {
  const headers = event.headers || {};
  const target = name.toLowerCase();
  const actual = Object.keys(headers).find((key) => key.toLowerCase() === target);
  return actual ? headers[actual] : "";
}

function corsHeaders(event) {
  const configuredOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = headerValue(event, "origin");
  const origin = configuredOrigin || requestOrigin || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(statusCode, body, headers) {
  return {
    statusCode,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function isAuthorized(event) {
  const secret = process.env.SHARED_SECRET || process.env.SYNC_SECRET;
  if (!secret) return true;
  return headerValue(event, "x-app-secret") === secret;
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

exports.handler = async (event) => {
  const cors = corsHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "method_not_allowed" }, cors);
  }

  if (!isAuthorized(event)) {
    return json(401, { error: "unauthorized" }, cors);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "missing_anthropic_api_key" }, cors);
  }

  let payload;
  try {
    payload = parseBody(event);
  } catch (error) {
    return json(400, { error: "invalid_json", message: error.message }, cors);
  }

  if (!Array.isArray(payload.messages)) {
    return json(400, { error: "messages_required" }, cors);
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
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json"
      },
      body: JSON.stringify(upstreamPayload)
    });

    return {
      statusCode: response.status,
      headers: {
        ...cors,
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8"
      },
      body: await response.text()
    };
  } catch (error) {
    return json(502, { error: "anthropic_request_failed", message: error.message }, cors);
  }
};
