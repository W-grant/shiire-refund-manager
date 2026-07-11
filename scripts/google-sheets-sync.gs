const CONFIG = {
  purchaseSheetName: '仕入管理',
  salesSheetName: '販売管理',
  catawikiSheetName: 'CATAWIKI',
  ebaySheetName: 'EBAY',
  dashboardSheetName: 'ダッシュボード',
  syncLogSheetName: '同期ログ',
  secretPropertyName: 'SHEETS_SYNC_SECRET'
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

function doPost(e) {
  let payload = {};
  try {
    payload = JSON.parse(e.postData.contents || '{}');
    const secret = getSharedSecret_();
    if (secret && payload.secret !== secret) {
      return jsonOutput_({ ok: false, error: 'unauthorized' });
    }
    if (payload.type === 'purchases' || payload.type === 'all') {
      writeRows_(CONFIG.purchaseSheetName, payload.purchases || []);
    }
    if (payload.type === 'sales' || payload.type === 'all') {
      writeRows_(CONFIG.salesSheetName, payload.sales || []);
    }
    if (payload.type === 'purchases' || payload.type === 'sales' || payload.type === 'all') {
      writePlatformRows_(CONFIG.catawikiSheetName, payload.purchases || [], payload.sales || [], 'CATAWIKI');
      writePlatformRows_(CONFIG.ebaySheetName, payload.purchases || [], payload.sales || [], 'EBAY');
    }
    refreshDashboard();
    appendSyncLog_(payload, 'success', '');
    return jsonOutput_({
      ok: true,
      purchaseRows: Math.max(0, (payload.purchases || []).length - 1),
      salesRows: Math.max(0, (payload.sales || []).length - 1),
      catawikiRows: Math.max(0, platformRows_(payload.purchases || [], payload.sales || [], 'CATAWIKI').length - 1),
      ebayRows: Math.max(0, platformRows_(payload.purchases || [], payload.sales || [], 'EBAY').length - 1)
    });
  } catch (error) {
    appendSyncLog_(payload, 'failed', error.message || String(error));
    return jsonOutput_({ ok: false, error: error.message || String(error) });
  }
}

function getSharedSecret_() {
  return PropertiesService
    .getScriptProperties()
    .getProperty(CONFIG.secretPropertyName) || '';
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
  writeRows_(sheetName, rows);
  ui.alert(`${sheetName}へ${rows.length - 1}件を取り込みました。`);
}

function writeRows_(sheetName, rows) {
  if (!rows.length) return;
  const sheet = ensureSheet_(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
}

function writePlatformRows_(sheetName, purchaseRows, salesRows, destinationLabel) {
  writeRows_(sheetName, platformRows_(purchaseRows, salesRows, destinationLabel));
}

function platformRows_(purchaseRows, salesRows, destinationLabel) {
  const purchases = rowsToObjects_(purchaseRows);
  const sales = rowsToObjects_(salesRows);
  const salesByPurchaseId = sales.reduce((map, sale) => {
    const purchaseId = sale['アプリ仕入ID'] || '';
    if (!purchaseId) return map;
    if (!map[purchaseId]) map[purchaseId] = [];
    map[purchaseId].push(sale);
    return map;
  }, {});
  const rows = [
    ['アプリID', '商品名', 'メーカー名', '仕入れ日', '仕入れ価格', '送料・手数料', '支店', '担当', '証憑枚数', '状態', '管理番号', 'SKU', '出品日', '販売日', '販売価格', '粗利', 'メモ']
  ];
  purchases
    .filter((purchase) => matchesDestination_(purchase['利用先'], destinationLabel))
    .forEach((purchase) => {
      const linkedSales = (salesByPurchaseId[purchase['アプリID']] || [])
        .filter((sale) => normalizeDestination_(sale['販売先']) === destinationLabel);
      if (!linkedSales.length) {
        rows.push(platformRow_(purchase, {}, destinationLabel));
        return;
      }
      linkedSales.forEach((sale) => rows.push(platformRow_(purchase, sale, destinationLabel)));
    });
  return rows;
}

function platformRow_(purchase, sale) {
  return [
    purchase['アプリID'] || sale['アプリ仕入ID'] || '',
    purchase['商品名'] || sale['商品名'] || '',
    purchase['メーカー名'] || sale['メーカー名'] || '',
    purchase['仕入れ日'] || sale['仕入日'] || '',
    purchase['仕入れ価格'] || sale['仕入原価'] || 0,
    purchase['送料、手数料合計'] || 0,
    purchase['支店'] || '',
    purchase['担当'] || sale['担当'] || '',
    purchase['証憑枚数'] || 0,
    sale['状態'] || '未出品',
    sale['管理番号'] || '',
    sale['SKU'] || '',
    sale['出品日'] || '',
    sale['販売日'] || '',
    sale['販売価格'] || '',
    sale['粗利'] || '',
    sale['メモ'] || ''
  ];
}

function rowsToObjects_(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {}));
}

function matchesDestination_(value, destinationLabel) {
  const normalized = normalizeDestination_(value);
  return normalized === destinationLabel || normalized === '共通';
}

function normalizeDestination_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'CATAWIKI') return 'CATAWIKI';
  if (text === 'EBAY') return 'EBAY';
  if (text === '共通' || text === 'BOTH') return '共通';
  return text;
}

function appendSyncLog_(payload, result, message) {
  const sheet = ensureSheet_(CONFIG.syncLogSheetName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['同期日時', '結果', '対象', '仕入件数', '販売件数', 'メッセージ']);
  }
  sheet.appendRow([
    new Date(),
    result,
    payload.type || 'all',
    Math.max(0, (payload.purchases || []).length - 1),
    Math.max(0, (payload.sales || []).length - 1),
    message || ''
  ]);
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

function jsonOutput_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
