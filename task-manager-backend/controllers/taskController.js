const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// Helper: can the user access this project?
const canAccessProject = (project, user) => {
  if (user.role === 'admin') return true;
  return project.members.some(
    (memberId) => memberId.toString() === user._id.toString()
  );
};

// @desc    Create a task (admin only)
// @route   POST /api/tasks
// @access  Private/Admin
const createTask = async (req, res) => {
  try {
    const { title, description, project, assignedTo, dueDate, status } =
      req.body;

    // Validate project exists
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // If assigning, validate user exists and is a member of the project
    if (assignedTo) {
      const user = await User.findById(assignedTo);
      if (!user) {
        return res.status(404).json({ message: 'Assigned user not found' });
      }
      const isMember = projectDoc.members.some(
        (m) => m.toString() === assignedTo
      );
      if (!isMember && user.role !== 'admin') {
        return res.status(400).json({
          message: 'Assigned user must be a member of the project',
        });
      }
    }

    const task = await Task.create({
      title,
      description: description || '',
      project,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      status: status || 'todo',
      dueDate: dueDate || null,
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get tasks (filtered by project, or all visible to user)
// @route   GET /api/tasks?project=xxx&status=xxx&assignedTo=me
// @access  Private
const getTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.query.project) {
      // Verify access to the project first
      const projectDoc = await Project.findById(req.query.project);
      if (!projectDoc) {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (!canAccessProject(projectDoc, req.user)) {
        return res
          .status(403)
          .json({ message: 'You do not have access to this project' });
      }
      filter.project = req.query.project;
    } else if (req.user.role !== 'admin') {
      // Non-admin: only tasks from projects they're a member of
      const projects = await Project.find({ members: req.user._id }).select(
        '_id'
      );
      filter.project = { $in: projects.map((p) => p._id) };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.assignedTo === 'me') {
      filter.assignedTo = req.user._id;
    } else if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get task by id
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!canAccessProject(task.project, req.user)) {
      return res
        .status(403)
        .json({ message: 'You do not have access to this task' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update task (admin: full update, member: only their own task status)
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!canAccessProject(task.project, req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, assignedTo, dueDate, status } = req.body;

    // Members can ONLY change status, and only on tasks assigned to them
    if (req.user.role !== 'admin') {
      const isAssignedToUser =
        task.assignedTo &&
        task.assignedTo.toString() === req.user._id.toString();
      if (!isAssignedToUser) {
        return res.status(403).json({
          message: 'Members can only update tasks assigned to them',
        });
      }
      // Only status field is allowed for members
      if (
        title !== undefined ||
        description !== undefined ||
        assignedTo !== undefined ||
        dueDate !== undefined
      ) {
        return res.status(403).json({
          message: 'Members can only update task status',
        });
      }
      if (status !== undefined) task.status = status;
    } else {
      // Admin can update everything
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;

      if (assignedTo !== undefined) {
        if (assignedTo === null || assignedTo === '') {
          task.assignedTo = null;
        } else {
          const user = await User.findById(assignedTo);
          if (!user) {
            return res
              .status(404)
              .json({ message: 'Assigned user not found' });
          }
          task.assignedTo = assignedTo;
        }
      }
    }

    await task.save();

    const updated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete task (admin only)
// @route   DELETE /api/tasks/:id
// @access  Private/Admin
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
