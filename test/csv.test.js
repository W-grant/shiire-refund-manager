const assert = require("node:assert/strict");
const test = require("node:test");
const { parseCsv, toCsv } = require("../src/csv");

test("CSVはBOM付きで書き出し、引用符・カンマ・改行を保って読み戻せる", () => {
  const rows = [
    ["仕入日", "商品名", "金額(税込)", "メモ"],
    ["2026-06-21", "バッグ, 時計", "32500", "引用符\"あり、カンマ,あり\n改行あり"]
  ];

  const csv = toCsv(rows);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.deepEqual(parseCsv(csv), rows);
});

test("空文字を含むCSVを列数を崩さず読み取れる", () => {
  const rows = parseCsv("商品名,相手方氏名,メモ\r\n時計,,なし\r\n");
  assert.deepEqual(rows, [
    ["商品名", "相手方氏名", "メモ"],
    ["時計", "", "なし"]
  ]);
});
