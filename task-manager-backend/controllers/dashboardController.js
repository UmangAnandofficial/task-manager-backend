const Task = require('../models/Task');
const Project = require('../models/Project');

// @desc    Get dashboard stats for current user
// @route   GET /api/dashboard
// @access  Private
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // For admins: show overall stats. For members: show their tasks.
    const taskFilter =
      req.user.role === 'admin' ? {} : { assignedTo: userId };

    const [
      totalTasks,
      todoCount,
      inProgressCount,
      doneCount,
      overdueCount,
      myTasks,
      projectCount,
    ] = await Promise.all([
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, status: 'todo' }),
      Task.countDocuments({ ...taskFilter, status: 'in-progress' }),
      Task.countDocuments({ ...taskFilter, status: 'done' }),
      Task.countDocuments({
        ...taskFilter,
        status: { $ne: 'done' },
        dueDate: { $ne: null, $lt: now },
      }),
      Task.find({ assignedTo: userId })
        .populate('project', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
      req.user.role === 'admin'
        ? Project.countDocuments({})
        : Project.countDocuments({ members: userId }),
    ]);

    res.json({
      stats: {
        totalTasks,
        todo: todoCount,
        inProgress: inProgressCount,
        done: doneCount,
        overdue: overdueCount,
        projects: projectCount,
      },
      myTasks,
      role: req.user.role,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getDashboard };
