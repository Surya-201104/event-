import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: {
      type: String,
      enum: ["attendee", "organizer", "admin"],
      default: "attendee",
    },
    isAdmin: {
      // preserved for backward compatibility with existing checks
      type: Boolean,
      default: false,
    },
    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
    },
    premiumSince: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
