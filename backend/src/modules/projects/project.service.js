const repo = require('./project.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

async function createProject(data, ctx) {
  const project = await repo.createProject({ ...data, companyId: ctx.companyId, managerId: ctx.userId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'projects', documentId: String(project._id), newData: { name: project.name }, ip: ctx.ip });
  return project;
}

async function listProjects(ctx, query) { return repo.listProjects(ctx.companyId, query); }

async function getProject(id, ctx) {
  const project = await repo.findProjectById(id);
  if (!project || String(project.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Proyecto no encontrado', 'PROJECT_NOT_FOUND');
  return project;
}

async function updateProject(id, data, ctx) {
  const prev = await repo.findProjectById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Proyecto no encontrado', 'PROJECT_NOT_FOUND');
  const updated = await repo.updateProject(id, data);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'projects', documentId: id, previousData: { status: prev.status }, newData: { status: data.status }, ip: ctx.ip });
  return updated;
}

async function createTask(data, ctx) {
  const project = await repo.findProjectById(data.projectId);
  if (!project || String(project.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Proyecto no encontrado', 'PROJECT_NOT_FOUND');
  const task = await repo.createTask({ ...data, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'projects.tasks', documentId: String(task._id), newData: { title: task.title }, ip: ctx.ip });
  return task;
}

async function listTasks(ctx, query) { return repo.listTasks(ctx.companyId, query); }

async function updateTask(id, data, ctx) {
  const prev = await repo.findTaskById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Tarea no encontrada', 'TASK_NOT_FOUND');
  const updated = await repo.updateTask(id, data);
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'projects.tasks', documentId: id, previousData: { status: prev.status }, newData: { status: data.status }, ip: ctx.ip });
  return updated;
}

module.exports = { createProject, listProjects, getProject, updateProject, createTask, listTasks, updateTask };
