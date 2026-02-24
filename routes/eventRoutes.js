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
router.get("/:id", getEventById);
router.get("/manage/mine", protect, getManageableEvents);
router.get("/:id/attendees/export", protect, eventAdmin, exportEventAttendees);
router.post(
  "/",
  protect,
  upload.array("media", 5), 
  createEvent,
);
router.put(
  "/:id",
  protect,
  eventAdmin,
  upload.array("media", 5),
  updateEvent,
);

router.put("/:id/approval", protect, admin, updateEventApproval);
router.delete("/:id", protect, eventAdmin, deleteEvent);

export default router;
