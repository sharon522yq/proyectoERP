const atomic = require('../../utils/atomic');
const Project = require('./project.model');
const Task = require('./task.model');
const { pick, assertCompany } = require('../../utils/companyAccess');
const User = require('../users/user.model');
const repo = require('./project.repository');
const { ApiError } = require('../../utils/ApiError');
const { logAudit } = require('../../middlewares/audit');

const projectFields = ['name', 'description', 'status', 'startDate', 'endDate', 'budget'];
const taskFields = ['title', 'description', 'status', 'priority', 'assignedTo', 'dueDate'];
async function validateAssignee(data, ctx) {
  if (!data.assignedTo) return;
  const user = await User.findById(data.assignedTo);
  if (!user) throw new ApiError(404, 'Usuario no encontrado', 'USER_NOT_FOUND');
  assertCompany(ctx, user.companyId);
}
async function createProject(data, ctx) {
  const project = await repo.createProject({ ...pick(data, projectFields), companyId: ctx.companyId, managerId: ctx.userId });
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
  await Project.updateOne({ _id: id, companyId: ctx.companyId }, { $inc: { __v: 1 } });
  const prev = await repo.findProjectById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Proyecto no encontrado', 'PROJECT_NOT_FOUND');
  if (data.status === 'COMPLETED' && await Task.exists({ companyId: ctx.companyId, projectId: id, status: { $nin: ['DONE', 'CANCELLED'] } }))
    throw new ApiError(409, 'Completa o cancela las tareas pendientes antes de finalizar el proyecto.', 'PROJECT_TASKS_PENDING');
  const updated = await repo.updateProject(id, pick(data, projectFields));
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'projects', documentId: id, previousData: { status: prev.status }, newData: { status: data.status }, ip: ctx.ip });
  return updated;
}

async function createTask(data, ctx) {
  await Project.updateOne({ _id: data.projectId, companyId: ctx.companyId }, { $inc: { __v: 1 } });
  const project = await repo.findProjectById(data.projectId);
  if (!project || String(project.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Proyecto no encontrado', 'PROJECT_NOT_FOUND');
  if (['COMPLETED', 'CANCELLED'].includes(project.status)) throw new ApiError(409, 'El proyecto está cerrado. No admite nuevas tareas.', 'PROJECT_CLOSED');
  await validateAssignee(data, ctx);
  const task = await repo.createTask({ ...pick(data, taskFields), projectId: data.projectId, companyId: ctx.companyId });
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'CREATE', module: 'projects.tasks', documentId: String(task._id), newData: { title: task.title }, ip: ctx.ip });
  return task;
}

async function listTasks(ctx, query) { return repo.listTasks(ctx.companyId, query); }

async function updateTask(id, data, ctx) {
  const prev = await repo.findTaskById(id);
  if (!prev || String(prev.companyId) !== String(ctx.companyId)) throw new ApiError(404, 'Tarea no encontrada', 'TASK_NOT_FOUND');
  await Project.updateOne({ _id: prev.projectId, companyId: ctx.companyId }, { $inc: { __v: 1 } });
  const project = await repo.findProjectById(prev.projectId);
  if (!project || ['COMPLETED', 'CANCELLED'].includes(project.status)) throw new ApiError(409, 'El proyecto está cerrado. No admite cambios de tareas.', 'PROJECT_CLOSED');
  await validateAssignee(data, ctx);
  const updated = await repo.updateTask(id, pick(data, taskFields));
  await logAudit({ userId: ctx.userId, companyId: ctx.companyId, action: 'UPDATE', module: 'projects.tasks', documentId: id, previousData: { status: prev.status }, newData: { status: data.status }, ip: ctx.ip });
  return updated;
}

module.exports = { createProject, listProjects, getProject, updateProject: atomic(updateProject), createTask: atomic(createTask), listTasks, updateTask: atomic(updateTask) };
