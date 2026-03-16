import express from "express";
import {
  register,
  login,
  getMe,
  upgradeToPremium,
  getAllUsers,
  updateUserAccount,
  becomeOrganizer,
} from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";
import admin from "../middleware/adminMiddleware.js";

const router = express.Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.post("/upgrade", protect, upgradeToPremium);
router.post("/become-organizer", protect, becomeOrganizer);
router.get("/users", protect, admin, getAllUsers);
router.put("/users/:id", protect, admin, updateUserAccount);

export default router;
