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

test("User guide documents sales dashboard and Sheets sync operations", () => {
  const guide = readProjectFile("USER_GUIDE.md");
  const requiredSections = [
    "売上・利益を見る",
    "販売情報を管理する",
    "Googleスプレッドシートへ送信する",
    "対象月ごとの売上",
    "担当者別の粗利",
    "販売日と販売価格を必ず入力してください",
    "`CATAWIKI`",
    "`EBAY`",
    "`同期ログ`"
  ];

  for (const text of requiredSections) {
    assert.match(guide, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `USER_GUIDE.md should include ${text}`);
  }
});

test("V1 release documents include sales and Sheets release checks", () => {
  const documents = [
    ["docs/v1-completion-checklist.md", readProjectFile("docs/v1-completion-checklist.md")],
    ["docs/v1-final-release-check.md", readProjectFile("docs/v1-final-release-check.md")],
    ["docs/next-implementation-plan.md", readProjectFile("docs/next-implementation-plan.md")]
  ];
  const requiredTexts = [
    "販売管理",
    "経営ダッシュボード",
    "Googleスプレッドシート",
    "CATAWIKI",
    "EBAY",
    "粗利"
  ];

  for (const [fileName, content] of documents) {
    for (const text of requiredTexts) {
      assert.match(content, new RegExp(text), `${fileName} should mention ${text}`);
    }
  }
});
