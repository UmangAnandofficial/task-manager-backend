const Task = require('../models/Task');
const Project = require('../models/Project');

// dashboard ke liye saare stats ek API call me bhejte hain
// frontend pe alag alag cards me dikhane ke liye
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // admin ko poore system ka data, member ko sirf apne assigned tasks
    const taskFilter =
      req.user.role === 'admin' ? {} : { assignedTo: userId };

    // saari counting queries ek saath - performance ke liye
    const [
      totalTasks,
      newCount,
      assignedCount,
      inProgressCount,
      resolvedCount,
      overdueCount,
      pendingAcceptanceCount,
      myTasks,
      projectCount,
    ] = await Promise.all([
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, status: 'new' }),
      Task.countDocuments({ ...taskFilter, status: 'assigned' }),
      Task.countDocuments({ ...taskFilter, status: 'in-progress' }),
      Task.countDocuments({ ...taskFilter, status: 'resolved' }),

      // overdue - dueDate past hai aur abhi resolve nahi hua
      Task.countDocuments({
        ...taskFilter,
        status: { $ne: 'resolved' },
        dueDate: { $ne: null, $lt: now },
      }),

      // pending acceptance - sirf member ke liye useful
      // 'new' status + assignedTo current user
      Task.countDocuments({
        assignedTo: userId,
        status: 'new',
      }),

      // "My Tasks" - logged-in user ke 10 latest tasks
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
        new: newCount,
        assigned: assignedCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        overdue: overdueCount,
        pendingAcceptance: pendingAcceptanceCount,
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
