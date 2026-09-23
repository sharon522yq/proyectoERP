// Validación de salidas estructuradas del modelo (ETAPA 8).
// Si la respuesta no cumple el schema: no se utiliza → retry controlado (1) → respuesta segura.

const MAX_TEXT = 4000;
const MAX_ITEMS = 20;

function str(x, max = MAX_TEXT) {
  return typeof x === 'string' && x.length <= max;
}

// { tool: string|null, params: object, directAnswer: string }
function validateChatSelection(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['no es un objeto JSON'] };
  }
  const errors = [];
  const tool = data.tool === undefined ? null : data.tool;
  if (tool !== null && (!str(tool, 60) || !/^[a-zA-Z][a-zA-Z0-9_]{1,60}$/.test(tool))) {
    errors.push('tool inválida');
  }
  const params = data.params === undefined || data.params === null ? {} : data.params;
  if (typeof params !== 'object' || Array.isArray(params)) errors.push('params inválido');
  const directAnswer = data.directAnswer === undefined || data.directAnswer === null ? '' : data.directAnswer;
  if (!str(directAnswer)) errors.push('directAnswer inválido');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { tool, params, directAnswer } };
}

function stringArray(x, label, errors) {
  if (!Array.isArray(x) || x.length > MAX_ITEMS) {
    errors.push(`${label} debe ser un array de hasta ${MAX_ITEMS} elementos`);
    return [];
  }
  const out = [];
  for (const item of x) {
    if (!str(item, 1000)) errors.push(`${label} contiene elementos inválidos`);
    else out.push(item);
  }
  return out;
}

// { type:"analysis", summary, findings[], recommendations[], confidence:null|number }
function validateAnalysis(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['no es un objeto JSON'] };
  }
  const errors = [];
  if (data.type !== 'analysis') errors.push('type debe ser "analysis"');
  if (!str(data.summary, MAX_TEXT) || !data.summary.trim()) errors.push('summary inválido');
  const findings = stringArray(data.findings, 'findings', errors);
  const recommendations = stringArray(data.recommendations, 'recommendations', errors);
  const confidence = data.confidence === undefined ? null : data.confidence;
  if (confidence !== null && !(typeof confidence === 'number' && confidence >= 0 && confidence <= 1)) {
    errors.push('confidence debe ser null o un número entre 0 y 1');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { type: 'analysis', summary: data.summary, findings, recommendations, confidence } };
}

module.exports = { validateChatSelection, validateAnalysis };
