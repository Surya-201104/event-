import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    tickets: {
      type: Number,
      min: 1,
      default: 1,
    },
    ticketTypeId: {
      type: String,
      default: "",
    },
    ticketTypeName: {
      type: String,
      default: "General Admission",
    },
    ticketUnitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    attendeeName: {
      type: String,
      default: "",
    },
    attendeeEmail: {
      type: String,
      default: "",
    },
    attendeePhone: {
      type: String,
      default: "",
    },
    currency: {
      type: String,
      default: "INR",
    },
    paymentOrderId: {
      type: String,
      default: "",
    },
    paymentId: {
      type: String,
      default: "",
    },
    paymentSignature: {
      type: String,
      default: "",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      default: "",
    },
    paymentProvider: {
      type: String,
      default: "",
    },
    paymentVpa: {
      type: String,
      default: "",
    },
    paymentEmail: {
      type: String,
      default: "",
    },
    paymentContact: {
      type: String,
      default: "",
    },
    paymentCaptured: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
    },
  },
  { timestamps: true },
);

export default mongoose.model("Booking", bookingSchema);
