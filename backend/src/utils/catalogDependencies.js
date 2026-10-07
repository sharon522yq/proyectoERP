const mongoose = require('mongoose');
async function hasReferences(companyId, id, specifications) {
  const company = new mongoose.Types.ObjectId(String(companyId));
  const target = new mongoose.Types.ObjectId(String(id));
  for (const [collection, fields] of specifications) {
    const record = await mongoose.connection.collection(collection).findOne({ companyId: company, $or: fields.map(field => ({ [field]: target })) }, { projection: { _id: 1 } });
    if (record) return true;
  }
  return false;
}
const productReferences = [['inventory',['productId']],['inventory_movements',['productId']],['quotes',['items.productId']],['sales_orders',['items.productId']],['invoices',['items.productId']],['purchase_orders',['items.productId']],['boms',['productId','items.componentProductId']],['production_orders',['productId']],['material_consumptions',['productId']]];
const warehouseReferences = [['inventory',['warehouseId']],['inventory_movements',['warehouseId']],['production_orders',['warehouseId']],['material_consumptions',['warehouseId']]];
module.exports = { hasReferences, productReferences, warehouseReferences };
