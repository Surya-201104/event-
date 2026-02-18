import mongoose from "mongoose";

const ticketTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    sold: {
      type: Number,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      default: "",
      maxlength: 200,
    },
  },
  { _id: true },
);

const scheduleItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    startTime: {
      type: String,
      default: "",
    },
    endTime: {
      type: String,
      default: "",
    },
    speaker: {
      type: String,
      default: "",
      maxlength: 100,
    },
    description: {
      type: String,
      default: "",
      maxlength: 300,
    },
  },
  { _id: true },
);

const eventSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    organizerName: {
      type: String,
      default: "",
    },
    organizerContact: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "general",
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      default: "",
    },
    endTime: {
      type: String,
      default: "",
    },
    venue: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    ticketTypes: {
      type: [ticketTypeSchema],
      default: [],
    },
    schedule: {
      type: [scheduleItemSchema],
      default: [],
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    approvalNote: {
      type: String,
      default: "",
      maxlength: 300,
    },
    lastScheduleUpdate: {
      type: Date,
      default: null,
    },
    isPremiumOnly: {
      type: Boolean,
      default: false,
    },
    premiumPerks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
