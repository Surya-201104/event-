import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Generate Token Function
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      plan: user.plan || "free",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
};

// REGISTER
export const register = async (req, res) => {
  try {
    const { name, email, password, plan } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      plan: plan === "premium" ? "premium" : "free",
      premiumSince: plan === "premium" ? new Date() : null,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      plan: user.plan,
      premiumSince: user.premiumSince,
      token: generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      plan: user.plan || "free",
      premiumSince: user.premiumSince || null,
      token: generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET AUTHENTICATED USER PROFILE
export const getMe = async (req, res) => {
  try {
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      isAdmin: req.user.isAdmin || false,
      plan: req.user.plan || "free",
      premiumSince: req.user.premiumSince || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPGRADE ACCOUNT TO PREMIUM
export const upgradeToPremium = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.plan === "premium") {
      return res.status(400).json({ message: "Account is already Pro" });
    }

    user.plan = "premium";
    user.premiumSince = new Date();
    await user.save();

    res.json({
      message: "Upgraded to Pro successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin || false,
        plan: user.plan,
        premiumSince: user.premiumSince,
      },
      token: generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: LIST USERS
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("_id name email isAdmin plan premiumSince createdAt")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN: UPDATE USER ACCOUNT
export const updateUserAccount = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof req.body.isAdmin !== "undefined") {
      user.isAdmin = req.body.isAdmin === true || req.body.isAdmin === "true";
    }

    if (typeof req.body.plan !== "undefined") {
      if (!["free", "premium"].includes(req.body.plan)) {
        return res.status(400).json({ message: "Invalid plan value" });
      }
      user.plan = req.body.plan;
      user.premiumSince = req.body.plan === "premium" ? new Date() : null;
    }

    await user.save();

    return res.json({
      message: "User updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin || false,
        plan: user.plan || "free",
        premiumSince: user.premiumSince || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
