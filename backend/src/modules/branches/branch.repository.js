const Branch = require('./branch.model');

async function create(data) { return Branch.create(data); }
async function listByCompany(companyId) { return Branch.find({ companyId, active: true }).sort({ name: 1 }).lean(); }
async function getById(id) { return Branch.findById(id); }
async function update(id, data) { return Branch.findByIdAndUpdate(id, data, { new: true }); }

module.exports = { create, listByCompany, getById, update };
