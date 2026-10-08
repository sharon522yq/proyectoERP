const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');
const Company = require('../companies/company.model');
const Product = require('../products/product.model');
const Unit = require('../products/unit.model');
const Warehouse = require('./warehouse.model');
const Inventory = require('./inventory.model');
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const LIMIT = 10000;
let running = 0;

async function snapshot(companyId, warehouseId) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction({ readConcern: { level: 'snapshot' } });
    // Sequential reads belong to the same snapshot; no inventory writes.
    const company = await Company.findById(companyId).session(session).lean();
    if (!company) throw new ApiError(404, 'Empresa no encontrada', 'COMPANY_NOT_FOUND');
    const warehouses = await Warehouse.find({ companyId }).limit(LIMIT + 1).session(session).lean();
    const selected = warehouseId && warehouses.find(w => String(w._id) === warehouseId && !w.deletedAt);
    if (warehouseId && !selected) throw new ApiError(404, 'Almacén no encontrado', 'WAREHOUSE_NOT_FOUND');
    const stocks = await Inventory.find({ companyId, ...(warehouseId ? { warehouseId } : {}) }).limit(LIMIT + 1).session(session).lean();
    const products = await Product.find({ companyId }).sort({ sku: 1 }).limit(LIMIT + 1).session(session).lean();
    if ([warehouses, stocks, products].some(rows => rows.length > LIMIT)) throw new ApiError(413, 'El inventario supera el límite de exportación (10,000 registros por catálogo). Contacta al administrador para una exportación asistida.', 'EXPORT_TOO_LARGE');
    const units = await Unit.find({ _id: { $in: products.map(p => p.unitId).filter(Boolean) } }).session(session).lean();
    const capturedAt = new Date();
    return { company, warehouses, stocks, products, units, capturedAt, selected };
  } finally {
    if (session.inTransaction()) await session.abortTransaction();
    await session.endSession();
  }
}
function sheet(book, name, title, headers, widths) {
  const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.addRow([title]); ws.mergeCells(1, 1, 1, headers.length);
  ws.addRow(['Corte: ' + book.created.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) + ' (Ciudad de México)']); ws.mergeCells(2, 1, 2, headers.length);
  ws.addRow(['Existencias registradas; valoración al costo actual del catálogo, sin impuestos.']); ws.mergeCells(3, 1, 3, headers.length);
  ws.addRow(headers); ws.getRow(4).height = 28;
  ws.getRow(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF4338CA' } };
  ws.getRow(4).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  widths.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  return ws;
}
function finish(ws, headers, numeric, money) {
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, ws.rowCount), column: headers } };
  ws.eachRow((row, i) => {
    if (i < 5) return;
    row.eachCell(c => { c.font = { name: 'Calibri', size: 11 }; c.alignment = { vertical: 'top', wrapText: true }; if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; });
  });
  numeric.forEach(i => { ws.getColumn(i).numFmt = '#,##0.00'; });
  money.forEach(i => { ws.getColumn(i).numFmt = '#,##0.00'; });
  ws.getColumn(1).numFmt = '@';
}
const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
async function buildWorkbook(data) {
  const { company, warehouses, products, stocks, units, capturedAt, selected } = data;
  const book = new ExcelJS.Workbook(); book.creator = 'NexusERP'; book.created = capturedAt;
  const scope = selected ? ' · ' + selected.name : ' · Todos los almacenes';
  const stockSheet = sheet(book, 'Inventario', company.name + scope,
    ['SKU', 'Producto', 'Estado del producto', 'Almacén', 'Código', 'Estado del almacén', 'Unidad', 'Existencias', 'Reservadas', 'Disponibles', 'Costo unitario', 'Precio de venta', 'Moneda', 'Valor al costo', 'Último movimiento (UTC)'],
    [16, 30, 20, 26, 16, 20, 20, 16, 16, 16, 18, 18, 12, 20, 28]);
  const catalogSheet = sheet(book, 'Productos', company.name + scope,
    ['SKU', 'Producto', 'Estado', 'Unidad', 'Existencias', 'Reservadas', 'Disponibles', 'Costo unitario', 'Precio de venta', 'Moneda', 'Valor al costo', 'Stock mínimo'],
    [16, 32, 18, 22, 16, 16, 16, 18, 18, 12, 20, 16]);
  const productMap = new Map(products.map(p => [String(p._id), p]));
  const warehouseMap = new Map(warehouses.map(w => [String(w._id), w]));
  const unitMap = new Map(units.map(u => [String(u._id), u.symbol + ' · ' + u.name]));
  const totals = new Map();
  const unit = p => unitMap.get(String(p.unitId)) || 'Sin unidad asignada';
  const state = p => p.deletedAt ? 'Eliminado' : ({ ACTIVE: 'Activo', INACTIVE: 'Inactivo', DISCONTINUED: 'Descontinuado' }[p.status] || p.status);
  for (const s of stocks.sort((a, b) => String(a.warehouseId).localeCompare(String(b.warehouseId)) || String(a.productId).localeCompare(String(b.productId)))) {
    const p = productMap.get(String(s.productId)), w = warehouseMap.get(String(s.warehouseId));
    if (!p || !w) throw new ApiError(409, 'Hay existencias con referencias inválidas a productos o almacenes. Corrige el catálogo antes de exportar.', 'INVENTORY_REFERENCE_INVALID');
    const reserved = s.reservedQty || 0;
    stockSheet.addRow([p.sku, p.name, state(p), w.name, w.code, w.deletedAt ? 'Eliminado' : w.active ? 'Activo' : 'Desactivado', unit(p), s.quantity, reserved, s.quantity - reserved, p.cost, p.price, p.currency, roundMoney(s.quantity * p.cost), s.lastMovementAt ? s.lastMovementAt.toISOString() : 'Sin movimiento']);
    const total = totals.get(String(p._id)) || { quantity: 0, reserved: 0 };
    total.quantity += s.quantity; total.reserved += reserved; totals.set(String(p._id), total);
  }
  const currencies = new Map();
  for (const p of products) {
    const total = totals.get(String(p._id));
    if (selected && !total || p.deletedAt && !total) continue;
    const { quantity = 0, reserved = 0 } = total || {};
    const value = roundMoney(quantity * p.cost);
    catalogSheet.addRow([p.sku, p.name, state(p), unit(p), quantity, reserved, quantity - reserved, p.cost, p.price, p.currency, value, p.minimumStock]);
    currencies.set(p.currency, roundMoney((currencies.get(p.currency) || 0) + value));
  }
  finish(stockSheet, 15, [8, 9, 10], [11, 12, 14]); finish(catalogSheet, 12, [5, 6, 7, 12], [8, 9, 11]);
  const summary = sheet(book, 'Resumen', company.name + scope, ['Moneda', 'Valor al costo'], [24, 32]);
  for (const [currency, value] of currencies) summary.addRow([currency, value]);
  if (!currencies.size) summary.addRow(['Sin existencias registradas', null]);
  finish(summary, 2, [], [2]);
  // All user-controlled text is stored as literal strings, never Excel formulas.
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  const filename = 'Inventario_' + company.name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) + '_' + capturedAt.toISOString().replace(/[:.]/g, '-') + '.xlsx';
  return { filename, mimeType: MIME, base64: buffer.toString('base64') };
}
async function exportInventory(ctx, query) {
  if (!ctx.companyId) throw new ApiError(403, 'Selecciona una empresa antes de exportar', 'COMPANY_REQUIRED');
  if (running >= 2) throw new ApiError(429, 'Hay exportaciones en curso. Intenta nuevamente en unos momentos.', 'EXPORT_BUSY');
  running++;
  try {
    const data = await snapshot(ctx.companyId, query.warehouseId);
    const result = await buildWorkbook(data);
    await logAudit({ ...ctx, action: 'EXPORT', module: 'inventory', newData: { warehouseId: query.warehouseId || null, stockRows: data.stocks.length, capturedAt: data.capturedAt } });
    return result;
  } finally { running--; }
}
module.exports = { exportInventory, buildWorkbook };
