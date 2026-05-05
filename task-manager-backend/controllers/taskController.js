const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

// helper - check karta hai ki user is project ko access kar sakta hai ya nahi
// ye function projectController me bhi same hai - shayad future me utils me move karenge
const canAccessProject = (project, user) => {
  if (user.role === 'admin') return true;
  return project.members.some(
    (memberId) => memberId.toString() === user._id.toString()
  );
};

// naya task banata hai - sirf admin kar sakta hai
const createTask = async (req, res) => {
  try {
    const { title, description, project, assignedTo, dueDate, status } =
      req.body;

    // pehle project verify kar lo - galat id se task ban gaya to orphan ho jayega
    const projectDoc = await Project.findById(project);
    if (!projectDoc) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // agar task kisi ko assign kar rahe hain to do checks - user exist karta hai
    // aur woh is project ka member hai (admin ko exception diya hai)
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

    // populated response bhej rahe hain taaki frontend pe direct names dikhe
    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('project', 'name');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// tasks ki list - query params se filter ho sakti hai (project, status, assignedTo)
const getTasks = async (req, res) => {
  try {
    const filter = {};

    if (req.query.project) {
      // project specific tasks chahiye - pehle access verify karo
      // warna member kisi bhi project ka data dekh leta query me id daal ke
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
      // member ne project specify nahi kiya to sirf usi ke projects ke tasks dikhao
      // pehle uske projects ki ids nikaalo, fir us list me se tasks find karo
      const projects = await Project.find({ members: req.user._id }).select(
        '_id'
      );
      filter.project = { $in: projects.map((p) => p._id) };
    }

    // optional filters - status aur assignedTo
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // 'me' shortcut hai frontend ke liye - apne tasks dekhne ke liye
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

    // task ka project access check - same logic as project access
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

// task update - sabse complex function hai
// admin sab kuch update kar sakta hai, member sirf apne assigned task ka status
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('project');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // pehle project access check
    if (!canAccessProject(task.project, req.user)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, assignedTo, dueDate, status } = req.body;

    // member ke liye strict rules - sirf status, sirf apna task
    if (req.user.role !== 'admin') {
      // check 1 - kya ye task is member ko hi assigned hai?
      const isAssignedToUser =
        task.assignedTo &&
        task.assignedTo.toString() === req.user._id.toString();
      if (!isAssignedToUser) {
        return res.status(403).json({
          message: 'Members can only update tasks assigned to them',
        });
      }

      // check 2 - sirf status field allowed hai member ke liye
      // baaki kuch bhi update karne ki koshish ki to reject
      // ye important hai - frontend pe button hide kiya hai but API directly hit kar sakta hai
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
      // admin - har field update kar sakta hai
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (dueDate !== undefined) task.dueDate = dueDate;

      // assignedTo special case - null ya empty string aaye to unassign karna hai
      if (assignedTo !== undefined) {
        if (assignedTo === null || assignedTo === '') {
          task.assignedTo = null;
        } else {
          // verify user exist karta hai
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
  deleteTask,
};