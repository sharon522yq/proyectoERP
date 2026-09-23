const { asyncHandler } = require('../../utils/ApiError');
const svc = require('./project.service');

const ctx = (req) => ({ userId: req.user.id, companyId: req.companyId, ip: req.ip });

const createProject = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createProject(req.body, ctx(req)) }); });
const listProjects = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listProjects(ctx(req), req.query) }); });
const getProject = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.getProject(req.params.id, ctx(req)) }); });
const updateProject = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateProject(req.params.id, req.body, ctx(req)) }); });
const createTask = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createTask(req.body, ctx(req)) }); });
const listTasks = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.listTasks(ctx(req), req.query) }); });
const updateTask = asyncHandler(async (req, res) => { res.json({ success: true, data: await svc.updateTask(req.params.id, req.body, ctx(req)) }); });

module.exports = { createProject, listProjects, getProject, updateProject, createTask, listTasks, updateTask };
