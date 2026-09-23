const Unit = require('./unit.model');

const DEFAULT_UNITS = [
  { name: 'Pieza', symbol: 'pza', type: 'UNIT' },
  { name: 'Kilogramo', symbol: 'kg', type: 'WEIGHT' },
  { name: 'Gramo', symbol: 'g', type: 'WEIGHT' },
  { name: 'Litro', symbol: 'L', type: 'VOLUME' },
  { name: 'Mililitro', symbol: 'mL', type: 'VOLUME' },
  { name: 'Metro', symbol: 'm', type: 'LENGTH' },
  { name: 'Centímetro', symbol: 'cm', type: 'LENGTH' },
  { name: 'Metro cuadrado', symbol: 'm²', type: 'AREA' },
  { name: 'Caja', symbol: 'cx', type: 'UNIT' },
  { name: 'Par', symbol: 'par', type: 'UNIT' },
  { name: 'Docena', symbol: 'doc', type: 'UNIT' },
  { name: 'Tonelada', symbol: 't', type: 'WEIGHT' },
];

async function ensureSeeded() {
  for (const unit of DEFAULT_UNITS) {
    await Unit.updateOne({ name: unit.name }, { $setOnInsert: unit }, { upsert: true });
  }
}

async function list() { return Unit.find().sort({ name: 1 }).lean(); }

module.exports = { ensureSeeded, list };
