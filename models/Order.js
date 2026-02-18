import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  ticketType: String,
  amount: Number,
  paymentId: String,
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
  },
});

export default mongoose.model("Order", orderSchema);
