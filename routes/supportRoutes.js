import express from "express";
import {
  createSupportInquiry,
  getSupportInquiries,
  updateSupportInquiryStatus,
} from "../controllers/supportController.js";
import protect from "../middleware/authMiddleware.js";
import admin from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/", protect, createSupportInquiry);
router.get("/", protect, admin, getSupportInquiries);
router.put("/:id/status", protect, admin, updateSupportInquiryStatus);

export default router;
