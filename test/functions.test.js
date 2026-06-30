const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

function freshRequire(path) {
  delete require.cache[require.resolve(path)];
  return require(path);
}

function jsonEvent(body, headers = {}, method = "POST") {
  return {
    httpMethod: method,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    isBase64Encoded: false
  };
}

test("extract.js は OPTIONS、認証、Anthropic中継を扱える", async () => {
  const oldEnv = { ...process.env };
  const oldFetch = global.fetch;
  try {
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.SHARED_SECRET = "secret";
    const { handler } = freshRequire("../netlify/functions/extract");

    const options = await handler({ httpMethod: "OPTIONS", headers: {} });
    assert.equal(options.statusCode, 204);

    const unauthorized = await handler(jsonEvent({ messages: [] }, { "x-app-secret": "bad" }));
    assert.equal(unauthorized.statusCode, 401);

    let captured;
    global.fetch = async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ content: [{ type: "text", text: "{\"items\":[]}" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const ok = await handler(jsonEvent({ messages: [{ role: "user", content: "x" }] }, { "x-app-secret": "secret" }));
    assert.equal(ok.statusCode, 200);
    assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
    assert.equal(captured.init.headers["x-api-key"], "test-key");
  } finally {
    global.fetch = oldFetch;
    process.env = oldEnv;
    delete require.cache[require.resolve("../netlify/functions/extract")];
  }
});

test("sync.js は list/get/set/del と認証を扱える", async () => {
  const oldEnv = { ...process.env };
  const originalLoad = Module._load;
  const data = new Map();
  try {
    process.env.SYNC_SECRET = "secret";
    Module._load = function load(request, parent, isMain) {
      if (request === "@netlify/blobs") {
        return {
          getStore() {
            return {
              async list(options = {}) {
                const prefix = options.prefix || "";
                return {
                  blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
                  directories: []
                };
              },
              async get(key) {
                return data.has(key) ? data.get(key) : null;
              },
              async set(key, value) {
                data.set(key, value);
              },
              async delete(key) {
                data.delete(key);
              }
            };
          }
        };
      }
      return originalLoad.apply(this, arguments);
    };

    const { handler } = freshRequire("../netlify/functions/sync");
    const unauthorized = await handler(jsonEvent({ op: "list" }, { "x-app-secret": "bad" }));
    assert.equal(unauthorized.statusCode, 401);

    const headers = { "x-app-secret": "secret" };
    const set = await handler(jsonEvent({ op: "set", key: "rec/1", value: { id: "1" } }, headers));
    assert.equal(set.statusCode, 200);

    const get = await handler(jsonEvent({ op: "get", key: "rec/1" }, headers));
    assert.deepEqual(JSON.parse(get.body).value, { id: "1" });

    const list = await handler(jsonEvent({ op: "list", prefix: "rec/" }, headers));
    assert.deepEqual(JSON.parse(list.body).keys, ["rec/1"]);

    const del = await handler(jsonEvent({ op: "del", key: "rec/1" }, headers));
    assert.equal(del.statusCode, 200);
    assert.equal(data.has("rec/1"), false);
  } finally {
    Module._load = originalLoad;
    process.env = oldEnv;
    delete require.cache[require.resolve("../netlify/functions/sync")];
  }
});
