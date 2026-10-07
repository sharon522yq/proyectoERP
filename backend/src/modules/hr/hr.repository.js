const searchText = require('../../utils/searchText');
const Department = require('./department.model');
const Employee = require('./employee.model');

async function createDepartment(data) { return Department.create(data); }
async function findDepartmentById(id) { return Department.findById(id); }
async function listDepartments(companyId) {
  return Department.find({ companyId }).sort({ name: 1 }).lean();
}
async function updateDepartment(id, data) {
  await Department.updateOne({ _id: id }, { $set: data }, { runValidators: true });
  return Department.findById(id);
}

async function createEmployee(data) { return Employee.create(data); }
async function findEmployeeById(id) { return Employee.findById(id); }
async function listEmployees(companyId, { page = 1, limit = 20, departmentId, status, search } = {}) {
  const filter = { companyId };
  if (search) filter.$or = [{ name: { $regex: searchText(search), $options: 'i' } }, { employeeId: { $regex: searchText(search), $options: 'i' } }];
  if (departmentId) filter.departmentId = departmentId;
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Employee.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Employee.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateEmployee(id, data) {
  await Employee.updateOne({ _id: id }, { $set: data }, { runValidators: true });
  return Employee.findById(id);
}

module.exports = {
  createDepartment, findDepartmentById, listDepartments, updateDepartment,
  createEmployee, findEmployeeById, listEmployees, updateEmployee
};
