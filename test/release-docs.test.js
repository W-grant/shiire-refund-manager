const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("Release docs use Cloudflare Pages and current Supabase env names", () => {
  const docs = [
    ["README.md", readProjectFile("README.md")],
    ["docs/supabase-setup.md", readProjectFile("docs/supabase-setup.md")],
    ["docs/supabase-phase1-verification.md", readProjectFile("docs/supabase-phase1-verification.md")]
  ];

  for (const [fileName, content] of docs) {
    assert.match(content, /Cloudflare Pages/, `${fileName} should describe the current hosting target`);
    assert.match(content, /VITE_SUPABASE_URL/, `${fileName} should use VITE_SUPABASE_URL`);
    assert.match(content, /VITE_SUPABASE_ANON_KEY/, `${fileName} should use VITE_SUPABASE_ANON_KEY`);
    assert.doesNotMatch(content, /Netlifyに設定すべき環境変数/, `${fileName} should not point users to Netlify env settings`);
    assert.doesNotMatch(content, /`SUPABASE_URL`/, `${fileName} should not use the old frontend env name`);
    assert.doesNotMatch(content, /`SUPABASE_ANON_KEY`/, `${fileName} should not use the old frontend env name`);
    assert.doesNotMatch(content, /SYNC_SECRET/, `${fileName} should not advertise the old sync secret`);
  }
});
