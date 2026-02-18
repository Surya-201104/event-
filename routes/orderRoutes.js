import express from "express";
import { createOrder, saveOrder } from "../controllers/orderController.js";
import protect  from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/create", protect, createOrder);
router.post("/save", protect, saveOrder);

export default router;
