const CONFIG = {
  purchaseSheetName: '仕入管理',
  salesSheetName: '販売管理',
  dashboardSheetName: 'ダッシュボード'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('仕入れ還付管理')
    .addItem('仕入CSVを取り込み', 'importPurchaseCsv')
    .addItem('販売CSVを取り込み', 'importSalesCsv')
    .addItem('ダッシュボード更新', 'refreshDashboard')
    .addToUi();
}

function importPurchaseCsv() {
  importCsvToSheet_(CONFIG.purchaseSheetName, 'スプシ貼付_仕入.csv');
}

function importSalesCsv() {
  importCsvToSheet_(CONFIG.salesSheetName, 'スプシ貼付_販売.csv');
}

function importCsvToSheet_(sheetName, fileNameHint) {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    `${sheetName}へCSVを取り込みます`,
    `Google DriveにアップロードしたCSVファイル名を入力してください。\n例: ${fileNameHint}`,
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;

  const fileName = response.getResponseText().trim();
  if (!fileName) {
    ui.alert('ファイル名が空です。');
    return;
  }

  const files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) {
    ui.alert(`Google Drive上に "${fileName}" が見つかりません。`);
    return;
  }

  const file = files.next();
  const rows = Utilities.parseCsv(file.getBlob().getDataAsString('UTF-8'));
  if (!rows.length) {
    ui.alert('CSVに行がありません。');
    return;
  }

  const sheet = ensureSheet_(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
  ui.alert(`${sheetName}へ${rows.length - 1}件を取り込みました。`);
}

function refreshDashboard() {
  const sheet = ensureSheet_(CONFIG.dashboardSheetName);
  const salesSheet = ensureSheet_(CONFIG.salesSheetName);
  const values = salesSheet.getDataRange().getValues();
  const headers = values.shift() || [];
  const amountIndex = headers.indexOf('販売価格');
  const profitIndex = headers.indexOf('粗利');
  const destinationIndex = headers.indexOf('販売先');
  const statusIndex = headers.indexOf('状態');

  const soldRows = values.filter((row) => row[statusIndex] === '売却済み');
  const totalSales = soldRows.reduce((sum, row) => sum + Number(row[amountIndex] || 0), 0);
  const totalProfit = soldRows.reduce((sum, row) => sum + Number(row[profitIndex] || 0), 0);
  const byDestination = {};
  soldRows.forEach((row) => {
    const key = row[destinationIndex] || '未設定';
    byDestination[key] = (byDestination[key] || 0) + Number(row[profitIndex] || 0);
  });

  const output = [
    ['項目', '値'],
    ['売却済み件数', soldRows.length],
    ['売上合計', totalSales],
    ['粗利合計', totalProfit],
    ['利益率', totalSales ? totalProfit / totalSales : 0],
    [],
    ['販売先', '粗利'],
    ...Object.entries(byDestination)
  ];

  sheet.clearContents();
  sheet.getRange(1, 1, output.length, 2).setValues(output);
  sheet.getRange('B3:B4').setNumberFormat('¥#,##0');
  sheet.getRange('B5').setNumberFormat('0.0%');
  sheet.autoResizeColumns(1, 2);
}

function ensureSheet_(name) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  return book.getSheetByName(name) || book.insertSheet(name);
}
