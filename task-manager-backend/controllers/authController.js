const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// signup route - naya user banata hai
const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // pehle check kar lo email already use hua hai ya nahi
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // koi bhi signup karke khud ko admin nahi bana sakta
    // admin sirf seed script se ya existing admin se hi banta hai
    const newUserRole = role === 'admin' ? 'member' : role || 'member';

    const user = await User.create({
      name,
      email,
      password,
      role: newUserRole,
    });

    // token bhi saath me bhej do taaki frontend pe localStorage me save ho jaye
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// login - email + password match karke token return karta hai
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // password select:false hai schema me, isliye yahan +password lagana padta hai
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      // dono cases ke liye same message - security ke liye, taaki attacker ko pata na chale
      // ki email exist karta hai ya nahi
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// abhi jo user logged in hai uska data return karta hai
// req.user middleware se aata hai (protect.js)
const getMe = async (req, res) => {
  res.json(req.user);
};

module.exports = { signup, login, getMe };