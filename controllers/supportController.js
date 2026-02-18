import SupportInquiry from "../models/SupportInquiry.js";

const sanitizeText = (value, maxLength = 1000) =>
  String(value || "").trim().slice(0, maxLength);

export const createSupportInquiry = async (req, res) => {
  try {
    const name = sanitizeText(req.body.name || req.user?.name, 100);
    const email = sanitizeText(req.body.email || req.user?.email, 120);
    const subject = sanitizeText(req.body.subject, 140);
    const message = sanitizeText(req.body.message, 1000);

    if (!subject || !message) {
      return res.status(400).json({
        message: "Subject and message are required",
      });
    }

    const inquiry = await SupportInquiry.create({
      user: req.user._id,
      name,
      email,
      subject,
      message,
      status: "open",
    });

    return res.status(201).json({
      message: "Support inquiry submitted successfully",
      inquiry,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getSupportInquiries = async (req, res) => {
  try {
    const inquiries = await SupportInquiry.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.json(inquiries);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateSupportInquiryStatus = async (req, res) => {
  try {
    const inquiry = await SupportInquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ message: "Support inquiry not found" });
    }

    const nextStatus = sanitizeText(req.body.status, 30);
    const allowedStatuses = new Set(["open", "in_progress", "resolved"]);
    if (!allowedStatuses.has(nextStatus)) {
      return res.status(400).json({
        message: "status must be one of open, in_progress, resolved",
      });
    }

    inquiry.status = nextStatus;
    inquiry.adminReply = sanitizeText(req.body.adminReply, 1000);
    inquiry.resolvedAt = nextStatus === "resolved" ? new Date() : null;
    await inquiry.save();

    return res.json({
      message: "Support inquiry updated successfully",
      inquiry,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
