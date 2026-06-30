(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ShiireCsv = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(rows) {
    return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  }

  function parseCsv(text) {
    const body = String(text || "").replace(/^\ufeff/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < body.length; i += 1) {
      const char = body[i];
      const next = body[i + 1];

      if (quoted) {
        if (char === "\"" && next === "\"") {
          cell += "\"";
          i += 1;
        } else if (char === "\"") {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === "\"") {
        quoted = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }

    row.push(cell.replace(/\r$/, ""));
    if (row.length > 1 || row[0] !== "") rows.push(row);
    return rows;
  }

  return { csvCell, toCsv, parseCsv };
});
