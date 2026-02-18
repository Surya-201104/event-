import express from "express";
import { organizerAnalytics } from "../controllers/analyticsController.js";
import  protect  from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/", protect, organizerAnalytics);

export default router;
