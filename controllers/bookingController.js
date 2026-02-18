import Booking from "../models/Booking.js";
import Event from "../models/Event.js";

const sanitizeText = (value, maxLength = 120) =>
  String(value || "").trim().slice(0, maxLength);

const sanitizeEmail = (value) => sanitizeText(value, 120).toLowerCase();

const sanitizePhone = (value) =>
  String(value || "")
    .replace(/[^\d+]/g, "")
    .slice(0, 16);

const parseQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10);
};

const resolveTicketSelection = (event, ticketTypeId) => {
  const normalizedTypeId = sanitizeText(ticketTypeId, 80);
  if (Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0) {
    const selectedType = event.ticketTypes.find(
      (ticketType) => String(ticketType._id) === normalizedTypeId,
    );
    if (!selectedType) {
      return { error: "Selected ticket type is invalid" };
    }
    const quantity = Number(selectedType.quantity || 0);
    const sold = Number(selectedType.sold || 0);
    return {
      ticketTypeId: String(selectedType._id),
      ticketTypeName: selectedType.name || "General Admission",
      ticketUnitPrice: Number(selectedType.price || 0),
      available: Math.max(quantity - sold, 0),
    };
  }

  return {
    ticketTypeId: "",
    ticketTypeName: "General Admission",
    ticketUnitPrice: Number(event.price || 0),
    available: Number.MAX_SAFE_INTEGER,
  };
};

const decrementTicketSold = async (event, ticketTypeId, count) => {
  if (!ticketTypeId) return;
  const selectedType = event.ticketTypes.find(
    (ticketType) => String(ticketType._id) === String(ticketTypeId),
  );
  if (!selectedType) return;
  selectedType.sold = Math.max(
    Number(selectedType.sold || 0) - Number(count || 0),
    0,
  );
  await event.save();
};

export const createBooking = async (req, res) => {
  try {
    const {
      eventId,
      quantity,
      ticketTypeId,
      attendeeName,
      attendeeEmail,
      attendeePhone,
    } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    if (event.approvalStatus && event.approvalStatus !== "approved") {
      return res
        .status(403)
        .json({ message: "This event is not open for booking yet" });
    }

    const userPlan = req.user.plan || "free";
    if (event.isPremiumOnly && userPlan !== "premium") {
      return res.status(403).json({
        message:
          "This is a Pro-only event. Upgrade your account to Pro to book.",
      });
    }

    const tickets = parseQuantity(quantity);
    const ticketSelection = resolveTicketSelection(event, ticketTypeId);
    if (ticketSelection.error) {
      return res.status(400).json({ message: ticketSelection.error });
    }

    if (ticketSelection.available < tickets) {
      return res.status(400).json({ message: "Not enough tickets available" });
    }

    const totalAmount = Number(ticketSelection.ticketUnitPrice || 0) * tickets;
    const normalizedAttendeeName = sanitizeText(
      attendeeName || req.user?.name,
      100,
    );
    const normalizedAttendeeEmail = sanitizeEmail(
      attendeeEmail || req.user?.email,
    );
    const normalizedAttendeePhone = sanitizePhone(attendeePhone);

    const booking = await Booking.create({
      user: req.user._id,
      event: eventId,
      tickets,
      ticketTypeId: ticketSelection.ticketTypeId,
      ticketTypeName: ticketSelection.ticketTypeName,
      ticketUnitPrice: ticketSelection.ticketUnitPrice,
      attendeeName: normalizedAttendeeName,
      attendeeEmail: normalizedAttendeeEmail,
      attendeePhone: normalizedAttendeePhone,
      totalAmount,
      currency: "INR",
      paymentStatus: totalAmount > 0 ? "pending" : "paid",
      status: "confirmed",
    });

    if (totalAmount <= 0 && ticketSelection.ticketTypeId) {
      const selectedType = event.ticketTypes.find(
        (ticketType) =>
          String(ticketType._id) === String(ticketSelection.ticketTypeId),
      );
      if (selectedType) {
        selectedType.sold = Math.min(
          Number(selectedType.quantity || 0),
          Number(selectedType.sold || 0) + tickets,
        );
        await event.save();
      }
    }

    const populatedBooking = await booking.populate("event");

    return res.status(201).json(populatedBooking);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate("event")
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("event", "title date location price")
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("event");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    booking.status = "cancelled";
    if (booking.paymentStatus === "paid") {
      booking.paymentStatus = "refunded";
    }
    await booking.save();

    if (booking.ticketTypeId && booking.event?._id) {
      const event = await Event.findById(booking.event._id);
      if (event) {
        await decrementTicketSold(event, booking.ticketTypeId, booking.tickets || 1);
      }
    }

    return res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const transferBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("event");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cancelled ticket cannot be transferred" });
    }

    const nextName = sanitizeText(req.body.attendeeName, 100);
    const nextEmail = sanitizeEmail(req.body.attendeeEmail);
    const nextPhone = sanitizePhone(req.body.attendeePhone);

    if (!nextName || !nextEmail) {
      return res.status(400).json({
        message: "attendeeName and attendeeEmail are required",
      });
    }

    booking.attendeeName = nextName;
    booking.attendeeEmail = nextEmail;
    booking.attendeePhone = nextPhone;
    await booking.save();

    return res.json({
      message: "Ticket transferred successfully",
      booking,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status !== "cancelled") {
      return res.status(400).json({
        message: "Only cancelled tickets can be deleted",
      });
    }

    await booking.deleteOne();

    return res.json({ message: "Cancelled ticket deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const downloadTicket = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("event");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Cancelled bookings do not have an active ticket" });
    }

    return res.json({
      message: "Ticket Downloaded",
      ticket: {
        bookingId: booking._id,
        eventName: booking.event.title,
        date: booking.event.date,
        location: booking.event.location || booking.event.venue,
        ticketType: booking.ticketTypeName || "General Admission",
        quantity: booking.tickets || 1,
        attendeeName: booking.attendeeName || "",
        attendeeEmail: booking.attendeeEmail || "",
        attendeePhone: booking.attendeePhone || "",
        paymentStatus: booking.paymentStatus || "pending",
        paymentMethod: booking.paymentMethod || "",
        paymentProvider: booking.paymentProvider || "",
        paymentVpa: booking.paymentVpa || "",
        paymentId: booking.paymentId || "",
        paymentOrderId: booking.paymentOrderId || "",
        paidByEmail: booking.paymentEmail || "",
        paidByContact: booking.paymentContact || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
