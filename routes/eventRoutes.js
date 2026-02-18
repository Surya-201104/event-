import express from "express";
import {
  createEvent,
  getEvents,
  getManageableEvents,
  getEventById,
  updateEvent,
  updateEventApproval,
  exportEventAttendees,
  deleteEvent,
} from "../controllers/eventController.js";
import protect from "../middleware/authMiddleware.js";
import admin from "../middleware/adminMiddleware.js";
import eventAdmin from "../middleware/eventAdminMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getEvents);
router.get("/manage/mine", protect, getManageableEvents);
router.get("/:id", getEventById);
router.get("/:id/attendees/export", protect, eventAdmin, exportEventAttendees);
router.post("/", protect, upload.single("image"), createEvent);
router.put("/:id/approval", protect, admin, updateEventApproval);
router.put("/:id", protect, eventAdmin, upload.single("image"), updateEvent);
router.delete("/:id", protect, eventAdmin, deleteEvent);

export default router;
