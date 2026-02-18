import crypto from "crypto";
import razorpay, {
  isRazorpayConfigured,
  isMockGateway,
} from "../utils/payment.js";
import Event from "../models/Event.js";
import Booking from "../models/Booking.js";

const parseQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10);
};

const sanitizeText = (value, maxLength = 120) =>
  String(value || "").trim().slice(0, maxLength);

const sanitizeEmail = (value) => sanitizeText(value, 120).toLowerCase();

const sanitizeContact = (value) =>
  String(value || "")
    .replace(/[^\d+]/g, "")
    .slice(0, 16);

const sanitizeMethod = (value) => {
  const normalized = sanitizeText(value, 30).toLowerCase();
  const allowed = new Set([
    "upi",
    "card",
    "netbanking",
    "wallet",
    "emi",
    "paylater",
    "free",
  ]);

  return allowed.has(normalized) ? normalized : "";
};

const normalizePaymentDetails = (payment, fallback = {}) => {
  const provider = sanitizeText(
    payment?.bank || payment?.wallet || fallback.provider,
    80,
  );
  const method = sanitizeMethod(payment?.method || fallback.method);
  const vpa = sanitizeText(payment?.vpa || fallback.vpa, 120);
  const email = sanitizeEmail(payment?.email || fallback.email);
  const contact = sanitizeContact(payment?.contact || fallback.contact);
  const captured =
    payment?.captured === true ||
    payment?.captured === 1 ||
    fallback.captured === true;

  return {
    method,
    provider,
    vpa,
    email,
    contact,
    captured,
  };
};

const normalizeAttendeeData = (body, user) => {
  const attendeeName = sanitizeText(
    body.attendeeName || body.customerName || user?.name,
    100,
  );
  const attendeeEmail = sanitizeEmail(
    body.attendeeEmail || body.customerEmail || user?.email,
  );
  const attendeePhone = sanitizeContact(
    body.attendeePhone || body.customerContact,
  );

  return {
    attendeeName,
    attendeeEmail,
    attendeePhone,
  };
};

const resolveTicketSelection = (event, ticketTypeId, fallbackPrice) => {
  const normalizedTypeId = sanitizeText(ticketTypeId, 80);
  const hasTicketTypes =
    Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0;

  if (hasTicketTypes) {
    const selected = event.ticketTypes.find(
      (type) => String(type._id) === normalizedTypeId,
    );

    if (!selected) {
      return {
        error: "Selected ticket type is invalid",
      };
    }

    return {
      ticketTypeId: String(selected._id),
      ticketTypeName: selected.name || "General Admission",
      ticketUnitPrice: Number(selected.price || 0),
      availableTickets: Math.max(
        Number(selected.quantity || 0) - Number(selected.sold || 0),
        0,
      ),
    };
  }

  return {
    ticketTypeId: "",
    ticketTypeName: "General Admission",
    ticketUnitPrice: Number.isFinite(Number(fallbackPrice))
      ? Number(fallbackPrice)
      : Number(event.price || 0),
    availableTickets: Number.MAX_SAFE_INTEGER,
  };
};

const incrementTicketTypeSold = async (event, ticketTypeId, count) => {
  if (!ticketTypeId) return;

  const ticketType = event.ticketTypes.find(
    (type) => String(type._id) === String(ticketTypeId),
  );

  if (!ticketType) return;

  const nextSold = Number(ticketType.sold || 0) + Number(count || 0);
  ticketType.sold = Math.min(nextSold, Number(ticketType.quantity || nextSold));
  await event.save();
};

const buildEmailNotification = (email) => ({
  channel: "email",
  status: "sent_mock",
  to: email || "",
});

export const createOrder = async (req, res) => {
  try {
    const {
      eventId,
      quantity,
      customerName,
      customerEmail,
      customerContact,
      preferredMethod,
      ticketTypeId,
      attendeeName,
      attendeeEmail,
      attendeePhone,
    } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Event ID is required",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.approvalStatus && event.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "This event is not open for bookings yet",
      });
    }

    const userPlan = req.user.plan || "free";
    if (event.isPremiumOnly && userPlan !== "premium") {
      return res.status(403).json({
        success: false,
        message:
          "This is a Pro-only event. Upgrade your account to Pro to book.",
      });
    }

    const normalizedQuantity = parseQuantity(quantity);
    const cleanName = sanitizeText(customerName, 80);
    const cleanEmail = sanitizeEmail(customerEmail);
    const cleanContact = sanitizeContact(customerContact);
    const cleanPreferredMethod = sanitizeMethod(preferredMethod);
    const attendee = normalizeAttendeeData(
      {
        attendeeName,
        attendeeEmail,
        attendeePhone,
        customerName,
        customerEmail,
        customerContact,
      },
      req.user,
    );

    const ticketSelection = resolveTicketSelection(event, ticketTypeId, event.price);
    if (ticketSelection.error) {
      return res.status(400).json({
        success: false,
        message: ticketSelection.error,
      });
    }

    if (ticketSelection.availableTickets < normalizedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Not enough tickets available for selected ticket type",
      });
    }

    const totalAmount = ticketSelection.ticketUnitPrice * normalizedQuantity;

    if (totalAmount <= 0) {
      const freeBooking = await Booking.create({
        user: req.user._id,
        event: event._id,
        tickets: normalizedQuantity,
        ticketTypeId: ticketSelection.ticketTypeId,
        ticketTypeName: ticketSelection.ticketTypeName,
        ticketUnitPrice: ticketSelection.ticketUnitPrice,
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        attendeePhone: attendee.attendeePhone,
        totalAmount: 0,
        currency: "INR",
        paymentOrderId: `free_${Date.now()}`,
        paymentId: "FREE_EVENT",
        paymentSignature: "",
        paymentStatus: "paid",
        paymentMethod: "free",
        paymentProvider: "",
        paymentVpa: "",
        paymentEmail: cleanEmail || attendee.attendeeEmail,
        paymentContact: cleanContact || attendee.attendeePhone,
        paymentCaptured: true,
        status: "confirmed",
      });

      await incrementTicketTypeSold(
        event,
        ticketSelection.ticketTypeId,
        normalizedQuantity,
      );

      const populated = await freeBooking.populate("event");

      return res.status(200).json({
        success: true,
        freeEvent: true,
        booking: populated,
        notification: buildEmailNotification(attendee.attendeeEmail || cleanEmail),
        message: "Free event booking confirmed",
      });
    }

    if (!razorpay) {
      return res.status(503).json({
        success: false,
        message:
          "Payment gateway is not configured. Set real Razorpay keys or use PAYMENT_MODE=mock.",
      });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      notes: {
        userId: String(req.user._id),
        eventId: String(event._id),
        tickets: String(normalizedQuantity),
        customerName: cleanName,
        customerEmail: cleanEmail,
        customerContact: cleanContact,
        preferredMethod: cleanPreferredMethod,
        ticketTypeId: ticketSelection.ticketTypeId,
        ticketTypeName: ticketSelection.ticketTypeName,
        ticketUnitPrice: String(ticketSelection.ticketUnitPrice),
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        attendeePhone: attendee.attendeePhone,
      },
    });

    return res.status(200).json({
      success: true,
      isMock: isMockGateway,
      key: isMockGateway ? "rzp_test_mock_key" : process.env.RAZORPAY_KEY_ID,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      event: {
        id: event._id,
        title: event.title,
      },
      ticketType: {
        id: ticketSelection.ticketTypeId,
        name: ticketSelection.ticketTypeName,
        unitPrice: ticketSelection.ticketUnitPrice,
      },
      quantity: normalizedQuantity,
      totalAmount,
      customer: {
        name: cleanName,
        email: cleanEmail,
        contact: cleanContact,
      },
      attendee,
    });
  } catch (error) {
    console.error("Order creation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Order creation failed",
      error: error.message,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      eventId,
      quantity,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customerEmail,
      customerContact,
      preferredMethod,
      ticketTypeId,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      customerName,
    } = req.body;

    if (
      !eventId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification fields",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.approvalStatus && event.approvalStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "This event is not open for bookings yet",
      });
    }

    const userPlan = req.user.plan || "free";
    if (event.isPremiumOnly && userPlan !== "premium") {
      return res.status(403).json({
        success: false,
        message:
          "This is a Pro-only event. Upgrade your account to Pro to book.",
      });
    }

    const normalizedQuantity = parseQuantity(quantity);
    const ticketSelection = resolveTicketSelection(event, ticketTypeId, event.price);

    if (ticketSelection.error) {
      return res.status(400).json({
        success: false,
        message: ticketSelection.error,
      });
    }

    if (ticketSelection.availableTickets < normalizedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Not enough tickets available for selected ticket type",
      });
    }

    const totalAmount = ticketSelection.ticketUnitPrice * normalizedQuantity;
    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const existing = await Booking.findOne({
      paymentId: razorpay_payment_id,
      user: req.user._id,
    }).populate("event");

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        booking: existing,
      });
    }

    let isSignatureValid = false;
    const fallbackPaymentDetails = {
      method: sanitizeMethod(preferredMethod),
      email: sanitizeEmail(customerEmail),
      contact: sanitizeContact(customerContact),
      captured: true,
    };

    if (!razorpay) {
      return res.status(503).json({
        success: false,
        message:
          "Payment gateway is not configured. Set real Razorpay keys or use PAYMENT_MODE=mock.",
      });
    }

    if (isMockGateway) {
      isSignatureValid =
        razorpay_order_id.startsWith("order_") &&
        razorpay_payment_id.startsWith("pay_") &&
        razorpay_signature === "mock_signature";
    } else if (isRazorpayConfigured) {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      isSignatureValid = expectedSignature === razorpay_signature;
    }

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    let razorpayPayment = null;
    if (!isMockGateway && isRazorpayConfigured && razorpay.payments?.fetch) {
      try {
        razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
      } catch (paymentFetchError) {
        console.warn(
          "Unable to fetch payment details from Razorpay:",
          paymentFetchError.message,
        );
      }
    }

    const attendee = normalizeAttendeeData(
      {
        attendeeName,
        attendeeEmail,
        attendeePhone,
        customerName,
        customerEmail,
        customerContact,
      },
      req.user,
    );

    const paymentDetails = isMockGateway
      ? normalizePaymentDetails(
          {
            method: fallbackPaymentDetails.method || "upi",
            email: fallbackPaymentDetails.email,
            contact: fallbackPaymentDetails.contact,
            captured: true,
          },
          { method: "upi", captured: true },
        )
      : normalizePaymentDetails(razorpayPayment, fallbackPaymentDetails);

    const booking = await Booking.create({
      user: req.user._id,
      event: event._id,
      tickets: normalizedQuantity,
      ticketTypeId: ticketSelection.ticketTypeId,
      ticketTypeName: ticketSelection.ticketTypeName,
      ticketUnitPrice: ticketSelection.ticketUnitPrice,
      attendeeName: attendee.attendeeName,
      attendeeEmail: attendee.attendeeEmail,
      attendeePhone: attendee.attendeePhone,
      totalAmount,
      currency: "INR",
      paymentOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      paymentSignature: razorpay_signature,
      paymentStatus: "paid",
      paymentMethod: paymentDetails.method,
      paymentProvider: paymentDetails.provider,
      paymentVpa: paymentDetails.vpa,
      paymentEmail: paymentDetails.email || attendee.attendeeEmail,
      paymentContact: paymentDetails.contact || attendee.attendeePhone,
      paymentCaptured: paymentDetails.captured,
      status: "confirmed",
    });

    await incrementTicketTypeSold(
      event,
      ticketSelection.ticketTypeId,
      normalizedQuantity,
    );

    const populatedBooking = await booking.populate("event");

    return res.status(201).json({
      success: true,
      message: "Payment verified and booking confirmed",
      booking: populatedBooking,
      notification: buildEmailNotification(
        attendee.attendeeEmail || paymentDetails.email,
      ),
    });
  } catch (error) {
    console.error("Payment verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};
