const assert = require("node:assert/strict");
const test = require("node:test");
const { classify, keikaRatio } = require("../src/classify");

const baseRecord = {
  date: "2026-06-21",
  rate: 10
};

const acceptanceCases = [
  {
    name: "フリマ古物・1万未満・匿名",
    input: { kind: "kobutsu", stock: "yes", qualified: "no", anon: "anon", amount: 8000, seller: "" },
    expectedKind: "古物商特例",
    expectedTax: 727
  },
  {
    name: "ヤフオク古物・1万以上・匿名",
    input: { kind: "kobutsu", stock: "yes", qualified: "no", anon: "anon", amount: 32500, seller: "Homeworker" },
    expectedKind: "経過措置 80%",
    expectedTax: 2364
  },
  {
    name: "市場古物・本名",
    input: { kind: "kobutsu", stock: "yes", qualified: "no", anon: "named", amount: 50000, seller: "山田" },
    expectedKind: "古物商特例",
    expectedTax: 4545
  },
  {
    name: "登録事業者から",
    input: { kind: "kobutsu", stock: "yes", qualified: "yes", anon: "named", amount: 50000, seller: "A商店" },
    expectedKind: "要インボイス",
    expectedTax: 4545
  },
  {
    name: "自社使用",
    input: { kind: "other", stock: "no", qualified: "no", anon: "named", amount: 50000, seller: "" },
    expectedKind: "経過措置 80%",
    expectedTax: 3636
  },
  {
    name: "準古物・地金・1万以上・匿名",
    input: { kind: "jun", stock: "yes", qualified: "no", anon: "anon", amount: 500000, seller: "" },
    expectedKind: "経過措置 80%",
    expectedTax: 36364
  },
  {
    name: "準古物・1万未満・匿名",
    input: { kind: "jun", stock: "yes", qualified: "no", anon: "anon", amount: 5000, seller: "" },
    expectedKind: "古物商特例（準古物）",
    expectedTax: 455
  }
];

const expectedRatios = {
  "古物商特例": 1,
  "古物商特例（準古物）": 1,
  "要インボイス": 1,
  "経過措置 80%": 0.8
};

test("第13章の受け入れテスト表と控除区分・控除税額が一致する", () => {
  for (const row of acceptanceCases) {
    const actual = classify({ ...baseRecord, ...row.input });
    assert.equal(actual.kind, row.expectedKind, row.name + ": 控除区分");
    assert.equal(actual.tax, row.expectedTax, row.name + ": 控除税額");
    assert.equal(actual.ratio, expectedRatios[row.expectedKind], row.name + ": 控除割合");
  }
});

test("経過措置の割合は基準日で 80% から 50%、その後 0% に変わる", () => {
  assert.equal(keikaRatio("2026-09-30"), 0.8);
  assert.equal(keikaRatio("2026-10-01"), 0.5);
  assert.equal(keikaRatio("2029-09-30"), 0.5);
  assert.equal(keikaRatio("2029-10-01"), 0);
});

test("登録事業者の判定は他条件より優先される", () => {
  const actual = classify({
    date: "2026-06-21",
    rate: 10,
    kind: "other",
    stock: "no",
    qualified: "yes",
    anon: "named",
    amount: 50000,
    seller: "A商店"
  });

  assert.equal(actual.kind, "要インボイス");
  assert.equal(actual.ratio, 1);
  assert.equal(actual.tax, 4545);
});
