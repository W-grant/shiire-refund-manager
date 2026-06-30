const { getStore } = require("@netlify/blobs");

const STORE_NAME = "shiire";

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
  const secret = process.env.SYNC_SECRET || process.env.SHARED_SECRET;
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

function requireKey(key) {
  if (!key || typeof key !== "string") {
    const error = new Error("key_required");
    error.statusCode = 400;
    throw error;
  }
}

function encodeValue(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function decodeValue(text) {
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function list(store, prefix) {
  const result = await store.list({ prefix: prefix || "" });
  const blobs = result.blobs || [];
  return {
    blobs,
    keys: blobs.map((blob) => blob.key),
    directories: result.directories || []
  };
}

async function get(store, key) {
  requireKey(key);
  const text = await store.get(key, { type: "text" });
  return { key, value: decodeValue(text), found: text !== null };
}

async function set(store, key, value) {
  requireKey(key);
  await store.set(key, encodeValue(value), {
    contentType: "application/json; charset=utf-8"
  });
  return { key, ok: true };
}

async function del(store, key) {
  requireKey(key);
  await store.delete(key);
  return { key, ok: true };
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

  let payload;
  try {
    payload = parseBody(event);
  } catch (error) {
    return json(400, { error: "invalid_json", message: error.message }, cors);
  }

  const store = getStore(STORE_NAME);
  const op = String(payload.op || "").toLowerCase();

  try {
    if (op === "list") {
      return json(200, await list(store, payload.prefix), cors);
    }
    if (op === "get") {
      return json(200, await get(store, payload.key), cors);
    }
    if (op === "set") {
      return json(200, await set(store, payload.key, payload.value), cors);
    }
    if (op === "del") {
      return json(200, await del(store, payload.key), cors);
    }

    return json(400, { error: "unknown_operation" }, cors);
  } catch (error) {
    return json(error.statusCode || 500, { error: error.message || "sync_failed" }, cors);
  }
};
