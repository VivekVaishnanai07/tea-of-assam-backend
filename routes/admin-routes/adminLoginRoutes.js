const express = require("express");
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const router = express.Router();

const db = mongoose.connection;

// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.collection("tos_users").findOne({ email });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access Denied: Admins only' });
    }

    if (password !== user.password) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user._id, firstName: user.firstName, lastName: user.lastName, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '30m' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Admin Login Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;