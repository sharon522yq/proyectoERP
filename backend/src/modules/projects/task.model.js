const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'], default: 'TODO', index: true },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dueDate: { type: Date }
}, { timestamps: true, collection: 'tasks' });

taskSchema.index({ companyId: 1, projectId: 1, status: 1 });

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
