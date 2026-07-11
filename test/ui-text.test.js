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

test("Sales dashboard and Google Sheets controls stay visible", () => {
  const requiredControls = [
    'id="dashboardMonth"',
    'id="screenNav"',
    'id="dashTaskBreakdown"',
    'id="salesFilterStaff"',
    'id="salesFilterText"',
    'id="syncSheetsBtn"',
    'id="quickFilters"',
    'id="dashYearPurchaseQty"',
    'id="dashYearPurchaseAmount"',
    'id="dashYearRevenue"',
    'id="dashYearProfit"',
    "担当者別 粗利",
    "販売先別 粗利",
    "未処理タスク",
    "スプシへ送信",
    "quickFilterDefinitions",
    "screenDefinitions",
    "証憑なし"
  ];

  for (const marker of requiredControls) {
    assert.equal(indexHtml.includes(marker), true, `${marker} should be present in the production UI`);
  }
});

test("Sales input validation prevents incomplete sold records", () => {
  const requiredMessages = [
    "売却済みの場合は販売日を入力してください",
    "売却済みの場合は販売価格を入力してください",
    "販売価格は0円以上で入力してください"
  ];

  for (const message of requiredMessages) {
    assert.equal(indexHtml.includes(message), true, `${message} should be present in sales validation`);
  }
});
