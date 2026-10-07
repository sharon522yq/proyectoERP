const { body, param } = require('express-validator');

const quoteItem = {
  productId: body('items.*.productId').isMongoId(),
  quantity: body('items.*.quantity').isInt({ min: 1 }).toInt(),
  unitPrice: body('items.*.unitPrice').isFloat({ min: 0 }).toFloat(),
};

const createQuote = [
  body('customerId').isMongoId(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }).toInt(),
  body('items.*.unitPrice').isFloat({ min: 0 }).toFloat(),
  body('items.*.taxRate').optional().isFloat({ min: 0, max: 100 }).toFloat(),
  body('items.*.discount').optional().isFloat({ min: 0 }).toFloat().custom((value, { req, path }) => {
    const index = path.match(/\[(\d+)\]/)?.[1];
    const item = req.body.items[index];
    if (Number(value) > Number(item.quantity) * Number(item.unitPrice)) throw new Error('El descuento excede el importe de la partida');
    return true;
  }),
];
const createPayment = [
  param('invoiceId').isMongoId(),
  body('requestId').optional().isString().isLength({ min: 8, max: 80 }),
  body('amount').isFloat({ min: 0.01 }).toFloat().custom(value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8),
  body('method').isIn(['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']),
];
const idParam = [body('warehouseId').optional().isMongoId(), param('id').isMongoId()];

module.exports = { createQuote, createPayment, idParam };
