import Razorpay from "razorpay";

const paymentMode = (process.env.PAYMENT_MODE || "").toLowerCase();
const runtimeEnv = (process.env.NODE_ENV || "development").toLowerCase();

export const isRazorpayConfigured =
  !!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_") &&
  !!process.env.RAZORPAY_KEY_SECRET;

const forceMockMode =
  paymentMode === "mock" || process.env.RAZORPAY_KEY_ID === "MOCK_MODE";
const forceLiveMode = paymentMode === "live";

export const isMockGateway =
  forceMockMode ||
  (!forceLiveMode && !isRazorpayConfigured && runtimeEnv !== "production");

const razorpay = isMockGateway
  ? {
      orders: {
        create: async (options) => ({
          id: `order_${Math.random().toString(36).slice(2, 11)}`,
          amount: options.amount,
          currency: options.currency || "INR",
          receipt: options.receipt,
          status: "created",
          created_at: Math.floor(Date.now() / 1000),
        }),
      },
    }
  : isRazorpayConfigured
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

export default razorpay;
