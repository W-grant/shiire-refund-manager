const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("Production UI messages avoid old English status text and object fallback", () => {
  const oldMessages = [
    "Saved package history: none",
    "Supabase insert succeeded",
    "Supabase update succeeded",
    "Supabase delete succeeded",
    "Tax package creation blocked",
    "Tax package delete blocked",
    "Evidence delete blocked",
    "AI extract failed",
    "[object Object]"
  ];

  for (const message of oldMessages) {
    assert.equal(indexHtml.includes(message), false, `${message} should not be shown in the UI`);
  }
});

test("Production UI contains Japanese operational status messages", () => {
  const expectedMessages = [
    "仕入を保存しました",
    "仕入を更新しました",
    "仕入を削除しました",
    "保存済みの税理士提出パッケージはありません",
    "税理士提出パッケージの作成には保存権限が必要です",
    "AI抽出に失敗しました"
  ];

  for (const message of expectedMessages) {
    assert.equal(indexHtml.includes(message), true, `${message} should be present in the UI`);
  }
});
