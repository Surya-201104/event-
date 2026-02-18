import Booking from "../models/Booking.js";
import Event from "../models/Event.js";

const parseBoolean = (value) => value === true || value === "true" || value === 1;

const sanitizeText = (value, maxLength = 200) =>
  String(value || "").trim().slice(0, maxLength);

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
    } catch (error) {
      return [];
    }
  }
  return [];
};

const normalizeTicketTypes = (rawTypes, fallbackPrice) => {
  const parsedTypes = parseJsonArray(rawTypes);
  const normalized = parsedTypes
    .map((item) => {
      const name = sanitizeText(item?.name || "General Admission", 60);
      const price = Number(item?.price);
      const quantity = Number(item?.quantity);
      const sold = Number(item?.sold);
      const description = sanitizeText(item?.description, 200);

      if (!name || !Number.isFinite(price) || price < 0) return null;
      if (!Number.isInteger(quantity) || quantity < 1) return null;

      return {
        _id: item?._id,
        name,
        price,
        quantity,
        sold:
          Number.isInteger(sold) && sold > 0
            ? Math.min(sold, quantity)
            : 0,
        description,
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const fallback = Number(fallbackPrice);
  return [
    {
      name: "General Admission",
      price: Number.isFinite(fallback) && fallback >= 0 ? fallback : 0,
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
    return Math.min(...ticketTypes.map((ticketType) => Number(ticketType.price || 0)));
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

const buildEventQuery = (reqQuery) => {
  const query = {};
  const andConditions = [];

  const search = sanitizeText(reqQuery.search, 80);
  const location = sanitizeText(reqQuery.location, 80);
  const category = sanitizeText(reqQuery.category, 50);
  const dateFrom = sanitizeText(reqQuery.dateFrom, 30);
  const dateTo = sanitizeText(reqQuery.dateTo, 30);
  const minPrice = Number(reqQuery.minPrice);
  const maxPrice = Number(reqQuery.maxPrice);

  if (reqQuery.approvalStatus) {
    andConditions.push({ approvalStatus: reqQuery.approvalStatus });
  } else {
    andConditions.push({
      $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
    });
  }

  if (search) {
    andConditions.push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { organizerName: { $regex: search, $options: "i" } },
      ],
    });
  }

  if (location) {
    andConditions.push({
      $or: [
        { location: { $regex: location, $options: "i" } },
        { venue: { $regex: location, $options: "i" } },
      ],
    });
  }

  if (category) {
    andConditions.push({
      category: { $regex: `^${category}$`, $options: "i" },
    });
  }

  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    const priceFilter = {};
    if (Number.isFinite(minPrice)) priceFilter.$gte = minPrice;
    if (Number.isFinite(maxPrice)) priceFilter.$lte = maxPrice;
    andConditions.push({ price: priceFilter });
  }

  if (dateFrom || dateTo) {
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);
    andConditions.push({ date: dateFilter });
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return query;
};

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
      imageUrl,
      videoUrl,
      price,
      category,
      ticketTypes,
      schedule,
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

    const imagePath = req.file
      ? `/uploads/${req.file.filename}`
      : sanitizeText(imageUrl, 500);

    const systemAdmin = !!req.user?.isAdmin;

    const event = new Event({
      createdBy: req.user?._id || null,
      eventAdmins: req.user?._id ? [req.user._id] : [],
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
      image: imagePath,
      imageUrl: imagePath,
      videoUrl: sanitizeText(videoUrl, 500),
      ticketTypes: normalizedTicketTypes,
      schedule: normalizedSchedule,
      approvalStatus: systemAdmin ? "approved" : "pending",
      approvalNote: systemAdmin
        ? "Approved automatically by admin"
        : "Awaiting admin review",
      lastScheduleUpdate: normalizedSchedule.length > 0 ? new Date() : null,
      isPremiumOnly: parseBoolean(isPremiumOnly),
      premiumPerks: sanitizeText(premiumPerks, 250),
    });

    const createdEvent = await event.save();

    return res.status(201).json({
      ...createdEvent.toObject(),
      message: systemAdmin
        ? "Event created successfully"
        : "Event submitted and awaiting admin approval",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const query = buildEventQuery(req.query);
    const events = await Event.find(query).sort({ date: 1, createdAt: -1 });
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getManageableEvents = async (req, res) => {
  try {
    const match =
      req.user?.isAdmin
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

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    return res.json(event);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const previousSchedule = JSON.stringify(event.schedule || []);

    event.title = sanitizeText(req.body.title, 120) || event.title;
    event.description = sanitizeText(req.body.description, 5000) || event.description;
    event.category = toSlug(req.body.category) || event.category;
    event.date = req.body.date || event.date;
    event.startTime = sanitizeText(req.body.startTime, 20) || event.startTime;
    event.endTime = sanitizeText(req.body.endTime, 20) || event.endTime;
    event.venue = sanitizeText(req.body.venue || req.body.location, 140) || event.venue;
    event.location =
      sanitizeText(req.body.location || req.body.venue, 140) || event.location || event.venue;
    event.videoUrl =
      typeof req.body.videoUrl === "string"
        ? sanitizeText(req.body.videoUrl, 500)
        : event.videoUrl;
    if (typeof req.body.isPremiumOnly !== "undefined") {
      event.isPremiumOnly = parseBoolean(req.body.isPremiumOnly);
    }
    if (typeof req.body.premiumPerks === "string") {
      event.premiumPerks = sanitizeText(req.body.premiumPerks, 250);
    }

    if (typeof req.body.ticketTypes !== "undefined") {
      const nextTypes = normalizeTicketTypes(req.body.ticketTypes, req.body.price);
      event.ticketTypes = nextTypes.map((ticketType) => ({
        ...ticketType,
        sold: Math.min(Number(ticketType.sold || 0), Number(ticketType.quantity || 0)),
      }));
      event.price = getMinimumTicketPrice(event.ticketTypes, req.body.price);
    } else if (typeof req.body.price !== "undefined") {
      const nextPrice = Number(req.body.price);
      if (Number.isFinite(nextPrice) && nextPrice >= 0) {
        event.price = nextPrice;
      }
    }

    if (typeof req.body.schedule !== "undefined") {
      event.schedule = normalizeSchedule(req.body.schedule);
    }

    if (req.file) {
      event.image = `/uploads/${req.file.filename}`;
      event.imageUrl = `/uploads/${req.file.filename}`;
    } else if (typeof req.body.imageUrl === "string") {
      const normalizedImage = sanitizeText(req.body.imageUrl, 500);
      event.image = normalizedImage;
      event.imageUrl = normalizedImage;
    }

    const nextSchedule = JSON.stringify(event.schedule || []);
    if (previousSchedule !== nextSchedule) {
      event.lastScheduleUpdate = new Date();
    }

    if (!req.user?.isAdmin) {
      event.approvalStatus = "pending";
      event.approvalNote = "Updated by organizer and awaiting admin review";
    }

    const updatedEvent = await event.save();
    const attendeeCount = await Booking.countDocuments({
      event: event._id,
      status: { $ne: "cancelled" },
    });

    return res.json({
      ...updatedEvent.toObject(),
      attendeesNotified:
        previousSchedule !== nextSchedule ? attendeeCount : 0,
      message:
        previousSchedule !== nextSchedule
          ? `Schedule updated. ${attendeeCount} attendees notified.`
          : "Event updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateEventApproval = async (req, res) => {
  try {
    const { approvalStatus, approvalNote } = req.body;
    const allowed = new Set(["approved", "rejected"]);

    if (!allowed.has(approvalStatus)) {
      return res.status(400).json({
        message: "approvalStatus must be either approved or rejected",
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

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
        approvalStatus === "approved"
          ? "Event approved successfully"
          : "Event rejected successfully",
      event,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const exportEventAttendees = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).select("title");
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const includeCancelled = parseBoolean(req.query.includeCancelled);
    const bookings = await Booking.find({
      event: req.params.id,
      ...(includeCancelled ? {} : { status: { $ne: "cancelled" } }),
    })
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const headers = [
      "Booking ID",
      "Event",
      "Ticket Type",
      "Quantity",
      "Unit Price",
      "Total Amount",
      "Attendee Name",
      "Attendee Email",
      "Attendee Phone",
      "Booked By",
      "Booked By Email",
      "Booking Status",
      "Payment Status",
      "Payment Method",
      "Booked On",
    ];

    const rows = bookings.map((booking) =>
      [
        booking._id,
        event.title,
        booking.ticketTypeName || "General Admission",
        booking.tickets || 1,
        booking.ticketUnitPrice ?? booking.event?.price ?? 0,
        booking.totalAmount ?? 0,
        booking.attendeeName || booking.user?.name || "",
        booking.attendeeEmail || booking.user?.email || "",
        booking.attendeePhone || "",
        booking.user?.name || "",
        booking.user?.email || "",
        booking.status || "confirmed",
        booking.paymentStatus || "pending",
        booking.paymentMethod || "",
        booking.createdAt ? new Date(booking.createdAt).toISOString() : "",
      ]
        .map(escapeCsvValue)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `${toSlug(event.title) || "event"}-attendees.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    await event.deleteOne();

    return res.json({ message: "Event deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
