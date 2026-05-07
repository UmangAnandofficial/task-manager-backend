const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // new lifecycle: new -> assigned -> in-progress -> resolved
    // 'new' = task created, member hasn't accepted yet (or unassigned)
    // 'assigned' = member accepted, hasn't started yet
    // 'in-progress' = member is actively working
    // 'resolved' = work complete
    status: {
      type: String,
      enum: ['new', 'assigned', 'in-progress', 'resolved'],
      default: 'new',
    },
    // optional - track why a task was rejected (helps admin decide reassignment)
    rejectionReason: {
      type: String,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ project: 1 });

module.exports = mongoose.model('Task', taskSchema);
