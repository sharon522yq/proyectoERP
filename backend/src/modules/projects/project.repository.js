const Project = require('./project.model');
const Task = require('./task.model');

async function createProject(data) { return Project.create(data); }
async function findProjectById(id) { return Project.findById(id); }
async function listProjects(companyId, { page = 1, limit = 20, status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateProject(id, data) {
  await Project.updateOne({ _id: id }, { $set: data }, { runValidators: true });
  return Project.findById(id);
}

async function createTask(data) { return Task.create(data); }
async function findTaskById(id) { return Task.findById(id); }
async function listTasks(companyId, { projectId, status, page = 1, limit = 20 } = {}) {
  const filter = { companyId };
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Task.find(filter).sort({ dueDate: 1 }).skip(skip).limit(limit).lean(),
    Task.countDocuments(filter)
  ]);
  return { items, total, page, limit };
}
async function updateTask(id, data) {
  await Task.updateOne({ _id: id }, { $set: data }, { runValidators: true });
  return Task.findById(id);
}

module.exports = { createProject, findProjectById, listProjects, updateProject, createTask, findTaskById, listTasks, updateTask };
