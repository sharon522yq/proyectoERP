const repo = require('./production.repository');
const productRepo = require('../products/product.repository');
const inventoryRepo = require('../inventory/inventory.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

// ---- BOM ----
async function createBom(data, ctx) {
  if (!data.productId || !data.items || !data.items.length) throw new ApiError(400, 'productId e items son requeridos', 'VALIDATION_ERROR');
  const product = await productRepo.findById(data.productId);
  if (!product || product.status !== 'ACTIVE' || String(product.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');

  // Validate all component products belong to same company
  for (const item of data.items) {
    const comp = await productRepo.findById(item.componentProductId);
    if (!comp || comp.status !== 'ACTIVE' || String(comp.companyId) !== String(ctx.companyId)) {
      throw new ApiError(400, `Producto componente ${item.componentProductId} no encontrado`, 'INVALID_COMPONENT');
    }
  }

  // Check for circular references (product can't be its own component)
  if (data.items.some(i => String(i.componentProductId) === String(data.productId))) {
    throw new ApiError(400, 'Un producto no puede ser componente de sí mismo', 'CIRCULAR_REFERENCE');
  }

  // Calculate total material cost
  let totalMaterialCost = 0;
  for (const item of data.items) {
    const comp = await productRepo.findById(item.componentProductId);
    item.unitCost = comp.cost || 0;
    item.totalCost = item.quantity * item.unitCost;
    totalMaterialCost += item.totalCost;
  }

  const bom = await repo.createBom({ ...data, companyId: ctx.companyId, totalMaterialCost });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'production.bom', documentId: String(bom._id), newData: { name: bom.name, productId: String(bom.productId) }, ip: ctx.ip });
  return bom;
}

async function listBoms(ctx, query) { return repo.listBoms(ctx.companyId, query); }

async function getBom(id, ctx) {
  const bom = await repo.findBomById(id);
  if (!bom || String(bom.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'BOM no encontrada', 'BOM_NOT_FOUND');
  return bom;
}

// ---- Production Orders ----
async function createProductionOrder(data, ctx) {
  if (!data.productId || !data.bomId || !data.warehouseId || !data.quantity) {
    throw new ApiError(400, 'productId, bomId, warehouseId y quantity son requeridos', 'VALIDATION_ERROR');
  }

  const product = await productRepo.findById(data.productId);
  if (!product || String(product.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Producto no encontrado', 'PRODUCT_NOT_FOUND');

  const bom = await repo.findBomById(data.bomId);
  if (!bom || String(bom.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'BOM no encontrada', 'BOM_NOT_FOUND');
  if (bom.productId.toString() !== data.productId) throw new ApiError(400, 'La BOM no corresponde al producto', 'BOM_MISMATCH');

  const warehouse = await inventoryRepo.findWarehouseById(data.warehouseId);
  if (!warehouse || !warehouse.active || String(warehouse.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Almacén no encontrado', 'WAREHOUSE_NOT_FOUND');

  const folio = await repo.nextFolio(ctx.companyId, 'PROD');

  // Calculate material cost
  const materialCost = bom.totalMaterialCost * data.quantity;
  const totalCost = materialCost + (data.laborCost || 0) + (data.overheadCost || 0);

  const order = await repo.createProductionOrder({
    ...data, folio, companyId: ctx.companyId, branchId: ctx.branchId,
    materialCost, totalCost, unitCost: totalCost / data.quantity,
    createdBy: ctx.userId
  });

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'production.orders', documentId: String(order._id), newData: { folio, productId: String(order.productId), quantity: order.quantity }, ip: ctx.ip });
  return order;
}

async function listProductionOrders(ctx, query) { return repo.listProductionOrders(ctx.companyId, query); }

async function getProductionOrder(id, ctx) {
  const order = await repo.findProductionOrderById(id);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de producción no encontrada', 'PRODUCTION_ORDER_NOT_FOUND');
  return order;
}

async function updateProductionOrderStatus(id, status, ctx) {
  const order = await repo.findProductionOrderById(id);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de producción no encontrada', 'PRODUCTION_ORDER_NOT_FOUND');

  // Validate status transitions
  const validTransitions = {
    DRAFT: ['PLANNED', 'CANCELLED'],
    PLANNED: ['RELEASED', 'CANCELLED'],
    RELEASED: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };
  if (!validTransitions[order.status]?.includes(status)) {
    throw new ApiError(400, `No se puede cambiar de ${order.status} a ${status}`, 'INVALID_STATUS_TRANSITION');
  }

  const updateData = { status };
  if (status === 'IN_PROGRESS') updateData.actualStartDate = new Date();
  if (status === 'COMPLETED' || status === 'CANCELLED') updateData.actualEndDate = new Date();

  const updated = await repo.updateProductionOrder(id, updateData);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'production.orders', documentId: id, previousData: { status: order.status }, newData: { status }, ip: ctx.ip });
  return updated;
}

// ---- Work Orders ----
async function createWorkOrder(data, ctx) {
  if (!data.productionOrderId || !data.name || !data.sequence) {
    throw new ApiError(400, 'productionOrderId, name y sequence son requeridos', 'VALIDATION_ERROR');
  }
  const po = await repo.findProductionOrderById(data.productionOrderId);
  if (!po || String(po.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de producción no encontrada', 'PRODUCTION_ORDER_NOT_FOUND');

  const wo = await repo.createWorkOrder({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'production.work_orders', documentId: String(wo._id), newData: { name: wo.name, sequence: wo.sequence }, ip: ctx.ip });
  return wo;
}

async function listWorkOrders(ctx, query) { return repo.listWorkOrders(ctx.companyId, query); }

async function updateWorkOrderStatus(id, status, ctx) {
  const wo = await repo.findWorkOrderById(id);
  if (!wo || String(wo.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Work Order no encontrada', 'WORK_ORDER_NOT_FOUND');

  const validTransitions = {
    PENDING: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: []
  };
  if (!validTransitions[wo.status]?.includes(status)) {
    throw new ApiError(400, `No se puede cambiar de ${wo.status} a ${status}`, 'INVALID_STATUS_TRANSITION');
  }

  const updateData = { status };
  if (status === 'IN_PROGRESS') updateData.startDate = new Date();
  if (status === 'COMPLETED' || status === 'CANCELLED') updateData.endDate = new Date();

  const updated = await repo.updateWorkOrder(id, updateData);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'production.work_orders', documentId: id, previousData: { status: wo.status }, newData: { status }, ip: ctx.ip });
  return updated;
}

// ---- Material Consumption ----
async function consumeMaterials(productionOrderId, ctx) {
  const order = await repo.findProductionOrderById(productionOrderId);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de producción no encontrada', 'PRODUCTION_ORDER_NOT_FOUND');
  if (!['RELEASED', 'IN_PROGRESS'].includes(order.status)) throw new ApiError(400, 'La orden debe estar RELEASED o IN_PROGRESS', 'INVALID_STATUS');

  const bom = await repo.findBomById(order.bomId);
  if (!bom) throw new ApiError(404, 'BOM no encontrada', 'BOM_NOT_FOUND');

  const consumptions = [];
  for (const bomItem of bom.items) {
    const qtyRequired = bomItem.quantity * order.quantity;

    // Check stock availability
    const stock = await inventoryRepo.findStock(ctx.companyId, order.warehouseId, bomItem.componentProductId);
    const availableStock = stock ? stock.quantity : 0;
    if (availableStock < qtyRequired) {
      throw new ApiError(400, `Stock insuficiente para producto ${bomItem.componentProductId}. Requerido: ${qtyRequired}, Disponible: ${availableStock}`, 'INSUFFICIENT_STOCK');
    }

    // Create consumption record
    const consumption = await repo.createMaterialConsumption({
      companyId: ctx.companyId,
      productionOrderId,
      productId: bomItem.componentProductId,
      warehouseId: order.warehouseId,
      quantityRequired: qtyRequired,
      quantityConsumed: qtyRequired,
      unitCost: bomItem.unitCost,
      totalCost: qtyRequired * bomItem.unitCost,
      status: 'COMPLETED',
      consumedAt: new Date(),
      consumedBy: ctx.userId
    });

    // Create inventory movement (SALE_EXIT)
    const prevStock = availableStock;
    const newStock = prevStock - qtyRequired;
    await inventoryRepo.upsertStock(ctx.companyId, order.warehouseId, bomItem.componentProductId, -qtyRequired);
    await inventoryRepo.createMovement({
      companyId: ctx.companyId,
      warehouseId: order.warehouseId,
      productId: bomItem.componentProductId,
      type: 'SALE_EXIT',
      quantity: qtyRequired,
      previousStock: prevStock,
      newStock,
      reason: `Consumo producción ${order.folio}`,
      referenceType: 'PRODUCTION',
      referenceId: productionOrderId,
      userId: ctx.userId
    });

    consumptions.push(consumption);
  }

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'production.orders', documentId: productionOrderId, newData: { action: 'CONSUME_MATERIALS', count: consumptions.length }, ip: ctx.ip });
  return consumptions;
}

// ---- Complete Production ----
async function completeProduction(productionOrderId, ctx) {
  const order = await repo.findProductionOrderById(productionOrderId);
  if (!order || String(order.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Orden de producción no encontrada', 'PRODUCTION_ORDER_NOT_FOUND');
  if (order.status !== 'IN_PROGRESS') throw new ApiError(400, 'La orden debe estar IN_PROGRESS', 'INVALID_STATUS');

  // Verify all materials consumed
  const consumptions = await repo.listMaterialConsumptions(ctx.companyId, { productionOrderId, limit: 1000 });
  const allConsumed = consumptions.items.every(c => c.status === 'COMPLETED');
  if (!allConsumed) throw new ApiError(400, 'No todos los materiales han sido consumidos', 'MATERIALS_NOT_CONSUMED');

  // Create finished product entry in inventory
  const stock = await inventoryRepo.findStock(ctx.companyId, order.warehouseId, order.productId);
  const prevStock = stock ? stock.quantity : 0;
  const newStock = prevStock + order.quantity;

  await inventoryRepo.upsertStock(ctx.companyId, order.warehouseId, order.productId, order.quantity);
  await inventoryRepo.createMovement({
    companyId: ctx.companyId,
    warehouseId: order.warehouseId,
    productId: order.productId,
    type: 'PURCHASE_ENTRY',
    quantity: order.quantity,
    previousStock: prevStock,
    newStock,
    reason: `Producción completada ${order.folio}`,
    referenceType: 'PRODUCTION',
    referenceId: productionOrderId,
    userId: ctx.userId
  });

  // Update order status
  const updated = await repo.updateProductionOrder(productionOrderId, {
    status: 'COMPLETED',
    actualEndDate: new Date()
  });

  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'production.orders', documentId: productionOrderId, newData: { status: 'COMPLETED', quantity: order.quantity }, ip: ctx.ip });
  return updated;
}

module.exports = {
  createBom, listBoms, getBom,
  createProductionOrder, listProductionOrders, getProductionOrder, updateProductionOrderStatus,
  createWorkOrder, listWorkOrders, updateWorkOrderStatus,
  consumeMaterials, completeProduction
};
