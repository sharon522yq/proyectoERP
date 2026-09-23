const Company = require('./company.model');

async function create(data) { return Company.create(data); }
async function list() { return Company.find({ active: true }).sort({ name: 1 }).lean(); }
async function getById(id) { return Company.findById(id); }
async function update(id, data) { return Company.findByIdAndUpdate(id, data, { new: true }); }

module.exports = { create, list, getById, update };
