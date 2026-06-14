const User = require("../u_models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Wrong password" });

   const token = jwt.sign(
  { id: user.id, role: user.role, locale: 'en' },  // ← add locale: 'en'
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
    res.json({ token });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};