const mongoose = require('mongoose');
const request = require('supertest');
const ExcelJS = require('exceljs');
const { createTestDatabase } = require('./helpers/database');
const { createApp } = require('../src/app');
const { ensureSeeded } = require('../src/modules/roles/role.service');
const Company = require('../src/modules/companies/company.model');
const Product = require('../src/modules/products/product.model');
const Warehouse = require('../src/modules/inventory/warehouse.model');
const Inventory = require('../src/modules/inventory/inventory.model');
const { exportInventory, buildWorkbook } = require('../src/modules/inventory/inventory-export.service');
let db, app, company, other, wh, second, foreign, admin, employee, isolated;
beforeAll(async () => {
  db = await createTestDatabase(); await mongoose.connect(db.getUri()); await ensureSeeded(); app = createApp();
  company = await Company.create({ name: 'Export QA' }); other = await Company.create({ name: 'Foreign QA' });
  wh = await Warehouse.create({ companyId: company._id, name: 'Principal', code: '01' });
  second = await Warehouse.create({ companyId: company._id, name: 'Segundo', code: '02' });
  foreign = await Warehouse.create({ companyId: other._id, name: 'Secreto', code: '03' });
  const rows = await Product.create(Array.from({ length: 25 }, (_, i) => ({ companyId: company._id, sku: String(i).padStart(3, '0'), name: i === 0 ? '=HYPERLINK("https://example.com")' : 'Producto ' + i, cost: 10, price: 15, currency: i === 24 ? 'USD' : 'MXN' })));
  await Inventory.create(rows.map(p => ({ companyId: company._id, warehouseId: wh._id, productId: p._id, quantity: 5, reservedQty: 2 })));
  await Inventory.create({ companyId: company._id, warehouseId: second._id, productId: rows[0]._id, quantity: 3, reservedQty: 1 });
  const secret = await Product.create({ companyId: other._id, sku: 'SECRET', name: 'Foreign secret', cost: 999, price: 999 });
  await Inventory.create({ companyId: other._id, warehouseId: foreign._id, productId: secret._id, quantity: 999 });
  await Product.create({ companyId: company._id, sku: 'EMPTY', name: 'Sin existencias', cost: 2, price: 3 });
  async function account(role, email, companyId) { return (await request(app).post('/api/v1/auth/register').send({ name: 'Synthetic', email, password: 'Password123', role, companyId })).body.data; }
  admin = await account('ADMIN', 'export@example.com', company._id);
  employee = await account('EMPLEADO', 'export-employee@example.com', company._id);
  isolated = await account('ADMIN', 'export-isolated@example.com');
}, 60000);
afterAll(async () => { await mongoose.disconnect(); await db.stop(); });
const get = user => request(app).get('/api/v1/inventory/export.xlsx').set('Authorization', 'Bearer ' + user.accessToken);
async function workbook(result) { const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(result.base64, 'base64')); return book; }
const ctx = () => ({ companyId: company._id, userId: admin.user._id || admin.user.id });

test('export requires authentication, both read permissions and a company', async () => {
  expect((await request(app).get('/api/v1/inventory/export.xlsx')).status).toBe(401);
  expect((await get(employee)).status).toBe(403);
  expect((await get(isolated)).status).toBe(403);
  const Role = require('../src/modules/roles/role.model');
  const User = require('../src/modules/users/user.model');
  const role = await Role.create({ name: 'EXPORT_STOCK_ONLY', permissions: ['inventory.read'] });
  await User.updateOne({ email: 'export-employee@example.com' }, { role: role.name });
  // Reload role in a new session so both token claims and current role contain inventory.read.
  const login = (await request(app).post('/api/v1/auth/login').send({ email: 'export-employee@example.com', password: 'Password123' })).body.data;
  expect((await get(login)).status).toBe(403);
});
test('authenticated JSON download contains valid XLSX, retains leading zeros, literal text and every page', async () => {
  const response = await get(admin);
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body.data.filename).toMatch(/^Inventario_Export_QA_.*\.xlsx$/);
  const book = await workbook(response.body.data), stock = book.getWorksheet('Inventario'), products = book.getWorksheet('Productos');
  expect(stock.rowCount).toBe(30); expect(products.rowCount).toBe(30);
  const first = products.getRow(5); expect(first.getCell(1).value).toBe('000'); expect(first.getCell(2).value).toBe('=HYPERLINK("https://example.com")');
  expect(first.getCell(2).type).toBe(ExcelJS.ValueType.String);
  expect([5, 6, 7, 11].map(col => first.getCell(col).value)).toEqual([8, 3, 5, 80]);
  const summary = book.getWorksheet('Resumen'); expect(summary.getRow(5).values.slice(1)).toEqual(['MXN', 1230]); expect(summary.getRow(6).values.slice(1)).toEqual(['USD', 50]);
  expect(JSON.stringify(products.getSheetValues())).not.toContain('Foreign secret');
  expect(products.autoFilter).toBe('A4:L30'); expect(products.views[0].ySplit).toBe(4);
});
test('single warehouse has only its stock; foreign and missing references cannot be exported', async () => {
  const data = await exportInventory(ctx(), { warehouseId: String(second._id) });
  const book = await workbook(data); expect(book.getWorksheet('Inventario').rowCount).toBe(5); expect(book.getWorksheet('Productos').getRow(5).getCell(5).value).toBe(3);
  await expect(exportInventory(ctx(), { warehouseId: String(foreign._id) })).rejects.toMatchObject({ status: 404 });
  expect((await get(admin).query({ warehouseId: 'invalid' })).status).toBe(400);
  expect((await get(admin).query({ warehouseId: String(foreign._id) })).status).toBe(404);
});
test('export is audited and changes no stocks or reservations', async () => {
  const before = JSON.stringify(await Inventory.find({}).sort({ _id: 1 }).lean());
  await exportInventory(ctx(), {});
  expect(JSON.stringify(await Inventory.find({}).sort({ _id: 1 }).lean())).toBe(before);
  const entry = await require('../src/modules/audit/audit.model').findOne({ companyId: company._id, action: 'EXPORT', module: 'inventory' });
  expect(entry.newData.stockRows).toBe(26); expect(entry.newData.base64).toBeUndefined();
});
test('empty warehouse exports valid headers and an empty summary; inconsistent references fail explicitly', async () => {
  const empty = await Warehouse.create({ companyId: company._id, name: 'Vacío', code: 'EMPTY' });
  const book = await workbook(await exportInventory(ctx(), { warehouseId: String(empty._id) }));
  expect(book.getWorksheet('Inventario').rowCount).toBe(4); expect(book.getWorksheet('Resumen').getCell('A5').value).toBe('Sin existencias registradas');
  await expect(buildWorkbook({ company, warehouses: [], products: [], units: [], stocks: [{ productId: new mongoose.Types.ObjectId(), warehouseId: empty._id }], capturedAt: new Date() })).rejects.toMatchObject({ code: 'INVENTORY_REFERENCE_INVALID' });
});

test('repeated exports are rate limited without anonymous file access', async () => {
  expect((await get(admin)).status).toBe(200);
  const limited = await get(admin); expect(limited.status).toBe(429); expect(limited.body.code).toBe('EXPORT_RATE_LIMIT');
});

test('a transient snapshot failure retries the entire read and succeeds', async () => {
  const error = Object.assign(new Error('Synthetic transient error'), { hasErrorLabel: label => label === 'TransientTransactionError' });
  const spy = jest.spyOn(Company, 'findById').mockImplementationOnce(() => ({ session: () => ({ lean: async () => { throw error; } }) }));
  try { const book = await workbook(await exportInventory(ctx(), {})); expect(book.getWorksheet('Inventario').rowCount).toBe(30); expect(spy).toHaveBeenCalledTimes(2); } finally { spy.mockRestore(); }
});
