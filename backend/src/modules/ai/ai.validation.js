const { body } = require('express-validator');

// Nota: un campo "companyId" en el body se ignora deliberadamente (nunca se lee):
// el aislamiento multiempresa usa el companyId del contexto autenticado (ETAPA 5).
const chat = [
  body('question').isString().trim().isLength({ min: 2, max: 2000 })
    .withMessage('question debe ser un texto de 2 a 2000 caracteres'),
  body('sessionId').optional()
    .isString().matches(/^[A-Za-z0-9_-]{4,64}$/)
    .withMessage('sessionId inválido')
];

const analyze = [
  body('scope').optional()
    .isString().trim().isLength({ max: 200 })
    .withMessage('scope inválido')
];

module.exports = { chat, analyze };
