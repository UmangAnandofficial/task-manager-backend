const Task = require('../models/Task');
const Project = require('../models/Project');

// dashboard ke liye saare stats ek API call me bhejte hain
// frontend pe alag alag cards me dikhane ke liye
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    // admin ko poore system ka data dikhega, member ko sirf apne assigned tasks
    const taskFilter =
      req.user.role === 'admin' ? {} : { assignedTo: userId };

    // saari counting queries ek saath chala rahe hain Promise.all se
    // taaki sequentially na chale - bahut slow ho jata
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

      // overdue ka logic - dueDate aaj se pehle ki ho aur task abhi tak done na hua ho
      // dueDate null wale tasks ko skip karna hai isliye $ne: null bhi check kar rahe hain
      Task.countDocuments({
        ...taskFilter,
        status: { $ne: 'done' },
        dueDate: { $ne: null, $lt: now },
      }),

      // "My Tasks" section ke liye - hamesha logged-in user ke tasks
      // chahe admin ho ya member, dono ke liye apne assigned tasks dikhane hain
      // limit 10 rakha hai taaki dashboard slow na ho
      Task.find({ assignedTo: userId })
        .populate('project', 'name')
        .sort({ createdAt: -1 })
        .limit(10),

      // project count bhi role ke hisaab se alag - admin ko total, member ko apne wale
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