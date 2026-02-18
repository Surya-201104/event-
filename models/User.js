import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  isAdmin: {
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
});

export default mongoose.model("User", userSchema);
