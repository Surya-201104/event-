import payment from "../utils/payment.js";
import Order from "../models/Order.js";

export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const razorpayOrder = await payment.orders.create({
      amount: amount * 100, // convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    });

    res.status(200).json(razorpayOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create payment order" });
  }
};

export const saveOrder = async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Failed to save order" });
  }
};
