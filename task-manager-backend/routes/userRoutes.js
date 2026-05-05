const express = require('express');
const User = require('../models/User');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// saare users ki list - admin only
// frontend pe project me member add karne ke time ye list use hoti hai (dropdown me)
router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    // password ko exclude kar rahe hain - kabhi galti se bhi expose nahi hona chahiye
    // schema me select:false hai par fir bhi safety ke liye yahan bhi -password
    const users = await User.find({}).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// kisi user ka role change karna - member ko admin banana ya wapas member banana
// sirf existing admin hi ye kar sakta hai (security ke liye important)
router.put('/:id/role', protect, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    // sirf in dono values me se ek hi accept karenge - warna invalid data db me chala jayega
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    // password field manually exclude kar rahe hain response me
    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;