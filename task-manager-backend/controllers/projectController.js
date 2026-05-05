const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

// helper - check karta hai ki user is project ko access kar sakta hai ya nahi
// admin ko sab kuch dikhta hai, member sirf usi project ko dekh payega jisme woh add kiya gaya hai
const canAccessProject = (project, user) => {
  if (user.role === 'admin') return true;

  // members array me ObjectId hote hain, isliye toString() karke compare kar rahe hain
  // warna === se match nahi hota
  return project.members.some(
    (memberId) => memberId.toString() === user._id.toString()
  );
};

// naya project banata hai - sirf admin kar sakta hai (route me middleware lagi hai)
const createProject = async (req, res) => {
  try {
    const { name, description, members } = req.body;

    // agar members bheje gaye hain to verify kar lo ki saare valid users hain
    // warna fake/galat IDs database me chali jayengi
    if (members && members.length > 0) {
      const validUsers = await User.find({ _id: { $in: members } });
      if (validUsers.length !== members.length) {
        return res
          .status(400)
          .json({ message: 'One or more member IDs are invalid' });
      }
    }

    const project = await Project.create({
      name,
      description: description || '',
      createdBy: req.user._id,
      members: members || [],
    });

    // create karne ke baad populated version return kar rahe hain
    // taaki frontend pe direct user ka name dikha sake instead of just IDs
    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role');

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// saare projects laata hai - role ke hisaab se filter hota hai
// admin ko poori list, member ko sirf apne wale
const getProjects = async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin' ? {} : { members: req.user._id };

    const projects = await Project.find(filter)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role')
      .sort({ createdAt: -1 }); // newest first

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// single project ka data - id ke through
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // access check - agar member hai aur is project ka part nahi hai to 403
    // important security check, warna URL me id daal ke koi bhi project dekh leta
    if (!canAccessProject(project, req.user)) {
      return res
        .status(403)
        .json({ message: 'You do not have access to this project' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// project ka name ya description update karta hai - sirf admin
const updateProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // sirf woh fields update kar rahe hain jo actually bheji gayi hain
    // undefined check zaroori hai warna empty string bhi accept ho jayegi
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// project me naya member add karna - admin only
const addMember = async (req, res) => {
  try {
    const { userId } = req.body;

    // pehle user ka existence check, fir project ka
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // duplicate add hone se rokna - warna ek hi user multiple baar add ho jayega
    if (project.members.some((m) => m.toString() === userId)) {
      return res
        .status(400)
        .json({ message: 'User is already a member of this project' });
    }

    project.members.push(userId);
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// project se member hata dena - admin only
const removeMember = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // filter se nikaal rahe hain - jis member ki id match nahi karti woh rakh lo
    project.members = project.members.filter(
      (m) => m.toString() !== req.params.userId
    );
    await project.save();

    const updated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email role');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// project delete - saath me uske saare tasks bhi delete ho jate hain
// warna orphan tasks reh jayenge database me jo kabhi access nahi honge
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // pehle tasks delete karo, fir project - cascade delete
    await Task.deleteMany({ project: project._id });
    await project.deleteOne();

    res.json({ message: 'Project and its tasks deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  addMember,
  removeMember,
  deleteProject,
};