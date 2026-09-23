const repo = require('./hr.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

async function createDepartment(data, ctx) {
  const dept = await repo.createDepartment({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'hr.departments', documentId: String(dept._id), newData: { name: dept.name }, ip: ctx.ip });
  return dept;
}

async function listDepartments(ctx) { return repo.listDepartments(ctx.companyId); }

async function createEmployee(data, ctx) {
  const emp = await repo.createEmployee({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'hr.employees', documentId: String(emp._id), newData: { name: emp.name, employeeId: emp.employeeId }, ip: ctx.ip });
  return emp;
}

async function listEmployees(ctx, query) { return repo.listEmployees(ctx.companyId, query); }

async function getEmployee(id, ctx) {
  const emp = await repo.findEmployeeById(id);
  if (!emp || String(emp.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Empleado no encontrado', 'EMPLOYEE_NOT_FOUND');
  return emp;
}

async function updateEmployee(id, data, ctx) {
  const prev = await repo.findEmployeeById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Empleado no encontrado', 'EMPLOYEE_NOT_FOUND');
  const updated = await repo.updateEmployee(id, data);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'hr.employees', documentId: id, previousData: { status: prev.status }, newData: { status: data.status }, ip: ctx.ip });
  return updated;
}

module.exports = { createDepartment, listDepartments, createEmployee, listEmployees, getEmployee, updateEmployee };
