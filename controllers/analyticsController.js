import Booking from "../models/Booking.js";
import Event from "../models/Event.js";

const toMonthKey = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const organizerAnalytics = async (req, res) => {
  try {
    const eventMatch = req.user?.isAdmin
      ? {}
      : {
          $or: [{ createdBy: req.user._id }, { eventAdmins: req.user._id }],
        };

    const events = await Event.find(eventMatch)
      .select("title date ticketTypes approvalStatus createdAt")
      .sort({ createdAt: -1 });

    if (events.length === 0) {
      return res.json({
        totals: {
          totalManagedEvents: 0,
          approvedEvents: 0,
          pendingEvents: 0,
          rejectedEvents: 0,
          totalTicketsSold: 0,
          totalCapacity: 0,
          attendanceRate: 0,
          grossRevenue: 0,
          refundedRevenue: 0,
          netRevenue: 0,
        },
        eventPerformance: [],
        monthlyRevenue: [],
        paymentBreakdown: [],
        recentBookings: [],
      });
    }

    const eventIdList = events.map((eventItem) => eventItem._id);
    const bookings = await Booking.find({ event: { $in: eventIdList } })
      .populate("user", "name email")
      .populate("event", "title date")
      .sort({ createdAt: -1 });

    const eventById = new Map(events.map((eventItem) => [String(eventItem._id), eventItem]));
    const statsByEvent = new Map();
    const monthlyByKey = new Map();
    const paymentBreakdownMap = new Map();

    let grossRevenue = 0;
    let refundedRevenue = 0;
    let totalTicketsSold = 0;
    let totalCapacity = 0;

    for (const eventItem of events) {
      const capacity = Array.isArray(eventItem.ticketTypes)
        ? eventItem.ticketTypes.reduce(
            (sum, ticketType) => sum + Number(ticketType.quantity || 0),
            0,
          )
        : 0;

      totalCapacity += capacity;

      statsByEvent.set(String(eventItem._id), {
        eventId: eventItem._id,
        title: eventItem.title,
        date: eventItem.date,
        approvalStatus: eventItem.approvalStatus || "approved",
        capacity,
        ticketsSold: 0,
        bookings: 0,
        revenue: 0,
        attendanceRate: 0,
      });
    }

    bookings.forEach((booking) => {
      const eventId = String(booking.event?._id || booking.event);
      if (!statsByEvent.has(eventId)) return;

      const eventStats = statsByEvent.get(eventId);
      const ticketCount = Number(booking.tickets || 1);
      const bookingRevenue = Number(booking.totalAmount || 0);
      const method = String(booking.paymentMethod || "unknown").toLowerCase();
      const isCancelled = booking.status === "cancelled";
      const isPaid = booking.paymentStatus === "paid";
      const isRefunded = booking.paymentStatus === "refunded";

      eventStats.bookings += 1;
      if (!isCancelled) {
        eventStats.ticketsSold += ticketCount;
        totalTicketsSold += ticketCount;
      }

      if (isPaid && !isCancelled) {
        eventStats.revenue += bookingRevenue;
        grossRevenue += bookingRevenue;

        const monthKey = toMonthKey(booking.createdAt);
        const currentMonth = monthlyByKey.get(monthKey) || {
          month: monthKey,
          revenue: 0,
          tickets: 0,
        };
        currentMonth.revenue += bookingRevenue;
        currentMonth.tickets += ticketCount;
        monthlyByKey.set(monthKey, currentMonth);

        const paymentStats = paymentBreakdownMap.get(method) || {
          method,
          count: 0,
          revenue: 0,
        };
        paymentStats.count += 1;
        paymentStats.revenue += bookingRevenue;
        paymentBreakdownMap.set(method, paymentStats);
      }

      if (isRefunded) {
        refundedRevenue += bookingRevenue;
      }
    });

    const eventPerformance = Array.from(statsByEvent.values()).map((item) => {
      const attendanceRate =
        item.capacity > 0 ? Math.round((item.ticketsSold / item.capacity) * 100) : 0;
      return {
        ...item,
        attendanceRate,
      };
    });

    const approvedEvents = events.filter(
      (eventItem) => eventItem.approvalStatus === "approved",
    ).length;
    const pendingEvents = events.filter(
      (eventItem) => eventItem.approvalStatus === "pending",
    ).length;
    const rejectedEvents = events.filter(
      (eventItem) => eventItem.approvalStatus === "rejected",
    ).length;

    const attendanceRate =
      totalCapacity > 0 ? Math.round((totalTicketsSold / totalCapacity) * 100) : 0;
    const netRevenue = grossRevenue - refundedRevenue;

    const recentBookings = bookings.slice(0, 10).map((booking) => ({
      bookingId: booking._id,
      eventTitle: booking.event?.title || eventById.get(String(booking.event))?.title || "",
      userName: booking.user?.name || "",
      tickets: booking.tickets || 1,
      totalAmount: booking.totalAmount || 0,
      status: booking.status || "confirmed",
      paymentStatus: booking.paymentStatus || "pending",
      createdAt: booking.createdAt,
    }));

    return res.json({
      totals: {
        totalManagedEvents: events.length,
        approvedEvents,
        pendingEvents,
        rejectedEvents,
        totalTicketsSold,
        totalCapacity,
        attendanceRate,
        grossRevenue,
        refundedRevenue,
        netRevenue,
      },
      eventPerformance: eventPerformance.sort(
        (a, b) => new Date(a.date) - new Date(b.date),
      ),
      monthlyRevenue: Array.from(monthlyByKey.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
      paymentBreakdown: Array.from(paymentBreakdownMap.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      recentBookings,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
