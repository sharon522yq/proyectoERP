const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/ApiError');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new ApiError(400, 'Datos inválidos', 'VALIDATION_ERROR');
    // Return field names only: never echo submitted passwords, tokens or personal data.
    error.fields = [...new Set(errors.array().map(item => item.path || item.param).filter(Boolean))];
    return next(error);
  }
  return next();
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message: status >= 500 ? 'No se pudo completar la operación' : err.message, code, ...(err.code === 'VALIDATION_ERROR' && err.fields ? { fields: err.fields } : {}) });
}

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Recurso no encontrado', code: 'NOT_FOUND' });
}

module.exports = { validate, errorHandler, notFound };
