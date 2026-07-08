const productionUrl = (process.env.PRODUCTION_URL || "https://shiire-refund-manager.pages.dev/").replace(/\/$/, "");

async function readText(url) {
  const response = await fetch(url);
  const text = await response.text();
  return { response, text };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const app = await readText(`${productionUrl}/`);
assert(app.response.status === 200, `Production URL returned ${app.response.status}`);
assert(app.text.includes("仕入れ還付管理"), "Production app title was not found");
assert(app.text.includes("ログインしていないため保存できません"), "Latest Japanese status text was not found");

const extract = await readText(`${productionUrl}/extract`);
assert(extract.response.status === 200, `/extract returned ${extract.response.status}`);

let extractPayload;
try {
  extractPayload = JSON.parse(extract.text);
} catch (error) {
  throw new Error("/extract did not return JSON");
}

assert(extractPayload.ok === true, "/extract health check did not return ok=true");
assert(extractPayload.anthropicConfigured === true, "/extract is missing ANTHROPIC_API_KEY");
assert(Object.prototype.hasOwnProperty.call(extractPayload, "authRequired"), "/extract did not report authRequired");

console.log(JSON.stringify({
  ok: true,
  productionUrl,
  appStatus: app.response.status,
  extractStatus: extract.response.status,
  anthropicConfigured: extractPayload.anthropicConfigured,
  authRequired: extractPayload.authRequired
}, null, 2));
