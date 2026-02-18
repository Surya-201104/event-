import express from "express";

import {
  createBooking,
  getMyBookings,
  cancelBooking,
  transferBooking,
  deleteBooking,
  downloadTicket,
  getAllBookings,
} from "../controllers/bookingController.js";

import protect from "../middleware/authMiddleware.js";
import admin from "../middleware/adminMiddleware.js";

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/me", protect, getMyBookings);
router.get("/", protect, admin, getAllBookings);
router.put("/cancel/:id", protect, cancelBooking);
router.put("/transfer/:id", protect, transferBooking);
router.delete("/:id", protect, deleteBooking);
router.get("/download/:id", protect, downloadTicket);

export default router;
