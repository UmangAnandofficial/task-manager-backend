const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// helper - check karta hai ki user is project ko access kar sakta hai ya nahi
const canAccessProject = (project, user) => {
  if (user.role === 'admin') return true;
  return project.members.some((member) => {
    // member populated ya raw ObjectId dono handle karna padta hai
    const memberId = member._id ? member._id.toString() : member.toString();
    return memberId === user._id.toString();
  });
};

// naya task banata hai - sirf admin kar sakta hai
// task default 'new' status me hi banta hai - member ko pehle accept karna hoga
const createTask = async (req, res) => {
  try {
    const { title, description, project, assignedTo, dueDate } = req.body;

    // pehle project verify kar lo
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // agar task kisi ko assign kar rahe hain to validate karo
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

    // naya task hamesha 'new' status se start hota hai
    // member accept karega tabhi 'assigned' me jayega
    const task = await Task.create({
      title,
      description: description || '',
      project,
      assignedTo: assignedTo || null,
      createdBy: req.user._id,
      status: 'new',
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

// tasks ki list - filter ho sakti hai project, status, assignedTo se
const getTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.query.project) {
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

// single task by id
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

// task update - admin sab kuch, member sirf apne task ka status (allowed transitions ke through)
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

    if (req.user.role !== 'admin') {
      // member sirf apne task pe action le sakta hai
      const isAssignedToUser =
        task.assignedTo &&
        task.assignedTo.toString() === req.user._id.toString();
      if (!isAssignedToUser) {
        return res.status(403).json({
          message: 'Members can only update tasks assigned to them',
        });
      }

      // member ke liye sirf status field allowed
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

      // member ke liye status transitions strict hain
      // accept/reject ke liye alag endpoint hai - yahan se sirf assigned -> in-progress -> resolved
      if (status !== undefined) {
        const allowedTransitions = {
          'assigned': ['in-progress'],
          'in-progress': ['resolved', 'assigned'], // wapas assigned bhi ja sakta hai agar galti se
        };

        const allowed = allowedTransitions[task.status];
        if (!allowed || !allowed.includes(status)) {
          return res.status(400).json({
            message: `Cannot move from "${task.status}" to "${status}". Use accept/reject for new tasks.`,
          });
        }

        task.status = status;
      }
    } else {
      // admin sab kuch kar sakta hai - including manually setting any status
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;

      if (assignedTo !== undefined) {
        if (assignedTo === null || assignedTo === '') {
          task.assignedTo = null;
          // unassign karte hi status wapas 'new' kar do
          task.status = 'new';
          task.rejectionReason = null;
        } else {
          const user = await User.findById(assignedTo);
          if (!user) {
            return res
              .status(404)
              .json({ message: 'Assigned user not found' });
          }
          // reassign karne pe status wapas 'new' - taaki naya member accept/reject kar sake
          task.assignedTo = assignedTo;
          task.status = 'new';
          task.rejectionReason = null;
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

// member task accept karta hai - 'new' se 'assigned' me move
const acceptTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!canAccessProject(task.project, req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // sirf assigned member hi accept kar sakta hai
    const isAssignedToUser =
      task.assignedTo &&
      task.assignedTo.toString() === req.user._id.toString();
    if (!isAssignedToUser) {
      return res.status(403).json({
        message: 'You can only accept tasks assigned to you',
      });
    }

    // sirf 'new' status wala task accept ho sakta hai
    if (task.status !== 'new') {
      return res.status(400).json({
        message: `Task is already in "${task.status}" status`,
      });
    }

    task.status = 'assigned';
    task.rejectionReason = null;
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

// member task reject karta hai - assignment hatti hai, admin reassign karega
const rejectTask = async (req, res) => {
  try {
    const { reason } = req.body;

    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!canAccessProject(task.project, req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const isAssignedToUser =
      task.assignedTo &&
      task.assignedTo.toString() === req.user._id.toString();
    if (!isAssignedToUser) {
      return res.status(403).json({
        message: 'You can only reject tasks assigned to you',
      });
    }

    // sirf 'new' wale task reject ho sakte hain
    // accept karne ke baad reject nahi kar sakte
    if (task.status !== 'new') {
      return res.status(400).json({
        message: 'You can only reject tasks before accepting them',
      });
    }

    // assignment clear, status wapas new (par admin ke liye visible)
    // reason store kar lete hain taaki admin ko pata chale kyon reject hua
    task.assignedTo = null;
    task.status = 'new';
    task.rejectionReason = reason || 'No reason provided';
    await task.save();

    res.json({
      message: 'Task rejected. Admin will reassign it.',
      task: await Task.findById(task._id)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .populate('project', 'name'),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// task delete - admin only
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
  acceptTask,
  rejectTask,
  deleteTask,
};
