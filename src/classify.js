(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShiireClassify = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const INVOICE = "要インボイス";
  const KOBUTSU = "古物商特例";
  const JUN_KOBUTSU = "古物商特例（準古物）";
  const NO_DEDUCTION = "控除不可";
  const NEEDS_CHECK = "要確認";

  function toNumber(value, fallback = 0) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/[,\s円]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  }

  function normalizeDate(date) {
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }

    if (typeof date === "string") {
      const match = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
    }

    return null;
  }

  function normalizeChoice(value, yesValue, noValue, fallback) {
    if (value === true) return yesValue;
    if (value === false) return noValue;
    if (typeof value === "string") return value.trim().toLowerCase();
    return fallback;
  }

  function baseTaxFor(amount, rate) {
    const safeAmount = Math.max(0, Math.round(toNumber(amount)));
    const safeRate = toNumber(rate, 10);
    return Math.round((safeAmount * safeRate) / (100 + safeRate));
  }

  function keikaRatio(date) {
    const key = normalizeDate(date);
    if (!key) return 0;
    if (key <= "2026-09-30") return 0.8;
    if (key <= "2029-09-30") return 0.5;
    return 0;
  }

  function keikaKind(ratio) {
    return ratio > 0 ? "経過措置 " + Math.round(ratio * 100) + "%" : NO_DEDUCTION;
  }

  function result(kind, ratio, baseTax, note, flags) {
    return {
      kind,
      ratio,
      tax: Math.round(baseTax * ratio),
      note,
      flags: flags || []
    };
  }

  function keikaResult(date, baseTax, note, flags) {
    const ratio = keikaRatio(date);
    return result(keikaKind(ratio), ratio, baseTax, note, flags);
  }

  function classify(record) {
    const source = record || {};
    const amount = Math.max(0, Math.round(toNumber(source.amount)));
    const rate = toNumber(source.rate, 10);
    const baseTax = baseTaxFor(amount, rate);
    const kind = normalizeChoice(source.kind, "kobutsu", "other", "");
    const stock = normalizeChoice(source.stock, "yes", "no", "");
    const qualified = normalizeChoice(source.qualified, "yes", "no", "unknown");
    const anon = normalizeChoice(source.anon, "anon", "named", "");
    const seller = typeof source.seller === "string" ? source.seller.trim() : "";
    const date = source.date;

    if (qualified === "yes") {
      return result(
        INVOICE,
        1,
        baseTax,
        "登録事業者。100%控除可だが適格請求書（または相手方確認済の仕入明細書）の保存が必須",
        []
      );
    }

    if (stock === "no" || kind === "other") {
      return keikaResult(
        date,
        baseTax,
        "古物商特例の対象外。経過措置の対象",
        []
      );
    }

    if (kind === "kobutsu") {
      if (amount >= 10000 && anon === "anon") {
        return keikaResult(
          date,
          baseTax,
          "古物・1万円以上・相手方が匿名（本人確認不可）→ 古物商特例の対象外。経過措置（取引画面の保存と『フリマ名＋アカウント名』での記帳が必要）",
          ["本名・住所を確認できれば古物商特例（100%控除）に切替可能"]
        );
      }

      const flags = [];
      if (amount >= 10000 && !seller) {
        flags.push("1万円以上は本人確認・本名/住所の記帳が必須");
      }

      return result(KOBUTSU, 1, baseTax, "古物商特例の対象", flags);
    }

    if (kind === "jun") {
      if (amount >= 10000 && anon === "anon") {
        return keikaResult(
          date,
          baseTax,
          "準古物・1万円以上・匿名 → 経過措置の可能性が高い区分。税理士に確認推奨",
          []
        );
      }

      return result(JUN_KOBUTSU, 1, baseTax, "古物商特例（準古物）の対象", []);
    }

    return {
      kind: NEEDS_CHECK,
      ratio: 0,
      tax: 0,
      note: "判定に必要な情報を確認してください",
      flags: []
    };
  }

  return {
    classify,
    keikaRatio,
    baseTaxFor,
    labels: {
      INVOICE,
      KOBUTSU,
      JUN_KOBUTSU,
      NO_DEDUCTION,
      NEEDS_CHECK
    }
  };
});
