import Booking from "../models/Booking.js";
import Event from "../models/Event.js";
import User from "../models/User.js";

/* =========================
   Utility Functions
========================= */

const parseBoolean = (value) =>
  value === true || value === "true" || value === 1;

const sanitizeText = (value, maxLength = 200) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const toSlug = (value) =>
  sanitizeText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeTicketTypes = (rawTypes, fallbackPrice) => {
  const parsed = parseJsonArray(rawTypes);

  const normalized = parsed
    .map((item) => {
      const name = sanitizeText(item?.name || "General Admission", 60);
      const price = Number(item?.price);
      const quantity = Number(item?.quantity);
      const sold = Number(item?.sold);

      if (!name || !Number.isFinite(price) || price < 0) return null;
      if (!Number.isInteger(quantity) || quantity < 1) return null;

      return {
        _id: item?._id,
        name,
        price,
        quantity,
        sold: Number.isInteger(sold) && sold > 0 ? Math.min(sold, quantity) : 0,
        description: sanitizeText(item?.description, 200),
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const fallback = Number(fallbackPrice);
  return [
    {
      name: "General Admission",
      price: Number.isFinite(fallback) ? fallback : 0,
      quantity: 100,
      sold: 0,
      description: "",
    },
  ];
};

const normalizeSchedule = (rawSchedule) =>
  parseJsonArray(rawSchedule)
    .map((item) => {
      const title = sanitizeText(item?.title, 100);
      if (!title) return null;

      return {
        _id: item?._id,
        title,
        startTime: sanitizeText(item?.startTime, 20),
        endTime: sanitizeText(item?.endTime, 20),
        speaker: sanitizeText(item?.speaker, 100),
        description: sanitizeText(item?.description, 300),
      };
    })
    .filter(Boolean);

const getMinimumTicketPrice = (ticketTypes, fallbackPrice) => {
  if (Array.isArray(ticketTypes) && ticketTypes.length > 0) {
    return Math.min(...ticketTypes.map((t) => Number(t.price || 0)));
  }
  const fallback = Number(fallbackPrice);
  return Number.isFinite(fallback) ? fallback : 0;
};

const escapeCsvValue = (value) => {
  const normalized = String(value ?? "");
  if (/[,"\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
};

const normalizeMediaUrl = (value) => sanitizeText(value, 500);

const buildMediaFromFiles = (files) =>
  (Array.isArray(files) ? files : [])
    .map((file) => {
      const type = file?.mimetype?.startsWith("video") ? "video" : "image";
      const folder = type === "video" ? "videos" : "images";
      return {
        type,
        url: `/uploads/${folder}/${file.filename}`,
      };
    })
    .filter((item) => item.url);

const mergeMediaItems = (...collections) => {
  const merged = [];
  const seen = new Set();

  collections.flat().forEach((item) => {
    const type = String(item?.type || "").toLowerCase() === "video" ? "video" : "image";
    const url = normalizeMediaUrl(item?.url);
    if (!url) return;

    const key = `${type}:${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    merged.push({ type, url });
  });

  return merged;
};

/* =========================
   CREATE EVENT
========================= */

export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      startTime,
      endTime,
      venue,
      location,
      price,
      category,
      ticketTypes,
      schedule,
      imageUrl,
      videoUrl,
      isPremiumOnly,
      premiumPerks,
    } = req.body;

    const normalizedVenue = sanitizeText(venue || location, 140);
    if (!normalizedVenue) {
      return res.status(400).json({ message: "Venue or location is required" });
    }

    const normalizedTicketTypes = normalizeTicketTypes(ticketTypes, price);
    const minTicketPrice = getMinimumTicketPrice(normalizedTicketTypes, price);
    const normalizedSchedule = normalizeSchedule(schedule);

    const media = mergeMediaItems(
      [
        { type: "image", url: imageUrl },
        { type: "video", url: videoUrl },
      ],
      buildMediaFromFiles(req.files),
    ).slice(0, 5);

    const systemAdmin = !!req.user?.isAdmin;
    const hasSystemAdmin = !!(await User.exists({ isAdmin: true }));
    const shouldAutoApprove = systemAdmin || !hasSystemAdmin;

    const event = new Event({
      createdBy: req.user?._id,
      eventAdmins: [req.user?._id],
      organizerName: req.user?.name || "",
      organizerContact: req.user?.email || "",
      title: sanitizeText(title, 120),
      description: sanitizeText(description, 5000),
      category: toSlug(category) || "general",
      date,
      startTime: sanitizeText(startTime, 20),
      endTime: sanitizeText(endTime, 20),
      venue: normalizedVenue,
      location: sanitizeText(location || normalizedVenue, 140),
      price: minTicketPrice,
      media,
      ticketTypes: normalizedTicketTypes,
      schedule: normalizedSchedule,
      approvalStatus: shouldAutoApprove ? "approved" : "pending",
      approvalNote: shouldAutoApprove
        ? "Approved automatically"
        : "Awaiting admin review",
      lastScheduleUpdate: normalizedSchedule.length > 0 ? new Date() : null,
      isPremiumOnly: parseBoolean(isPremiumOnly),
      premiumPerks: sanitizeText(premiumPerks, 250),
    });

    const createdEvent = await event.save();
    return res.status(201).json(createdEvent);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET EVENTS
========================= */

export const getEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET MANAGEABLE EVENTS (FIXED)
========================= */

export const getManageableEvents = async (req, res) => {
  try {
    const match = req.user?.isAdmin
      ? {}
      : {
          $or: [{ createdBy: req.user._id }, { eventAdmins: req.user._id }],
        };

    if (req.query.approvalStatus) {
      match.approvalStatus = req.query.approvalStatus;
    }

    const events = await Event.find(match).sort({ createdAt: -1 });

    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET SINGLE EVENT
========================= */

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    return res.json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   UPDATE EVENT
========================= */

export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    event.title = sanitizeText(req.body.title, 120) || event.title;
    event.description =
      sanitizeText(req.body.description, 5000) || event.description;
    event.category = toSlug(req.body.category) || event.category;
    event.date = req.body.date || event.date;
    event.startTime = sanitizeText(req.body.startTime, 20) || event.startTime;
    event.endTime = sanitizeText(req.body.endTime, 20) || event.endTime;

    const uploadedMedia = buildMediaFromFiles(req.files);
    const bodyMedia = mergeMediaItems([
      { type: "image", url: req.body.imageUrl },
      { type: "video", url: req.body.videoUrl },
    ]);

    if (uploadedMedia.length > 0 || bodyMedia.length > 0) {
      event.media = mergeMediaItems(event.media || [], bodyMedia, uploadedMedia).slice(
        0,
        5,
      );
    }

    if (!req.user?.isAdmin) {
      event.approvalStatus = "pending";
      event.approvalNote = "Updated by organizer and awaiting admin review";
    }

    const updatedEvent = await event.save();
    return res.json(updatedEvent);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   UPDATE EVENT APPROVAL
========================= */

export const updateEventApproval = async (req, res) => {
  try {
    const { approvalStatus, approvalNote } = req.body;
    const allowed = new Set(["approved", "rejected"]);

    if (!allowed.has(approvalStatus)) {
      return res.status(400).json({
        message: "approvalStatus must be approved or rejected",
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    event.approvalStatus = approvalStatus;
    event.approvalNote = sanitizeText(
      approvalNote ||
        (approvalStatus === "approved"
          ? "Approved by admin"
          : "Rejected by admin"),
      300,
    );

    await event.save();

    return res.json({
      message:
        approvalStatus === "approved" ? "Event approved" : "Event rejected",
      event,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   EXPORT ATTENDEES
========================= */

export const exportEventAttendees = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("title");
    if (!event) return res.status(404).json({ message: "Event not found" });

    const bookings = await Booking.find({
      event: req.params.id,
      status: { $ne: "cancelled" },
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const headers = [
      "Booking ID",
      "Event",
      "User Name",
      "User Email",
      "Quantity",
      "Total",
      "Status",
      "Booked On",
    ];

    const rows = bookings.map((b) =>
      [
        b._id,
        event.title,
        b.user?.name || "",
        b.user?.email || "",
        b.tickets || 1,
        b.totalAmount || 0,
        b.status || "confirmed",
        new Date(b.createdAt).toISOString(),
      ]
        .map(escapeCsvValue)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="event-attendees.csv"`,
    );

    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/* =========================
   DELETE EVENT
========================= */

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    await event.deleteOne();
    return res.json({ message: "Event deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
