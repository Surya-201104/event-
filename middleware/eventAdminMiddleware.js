import Event from "../models/Event.js";

const eventAdmin = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).select(
      "createdBy eventAdmins",
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const userId = req.user?._id?.toString();
    const isOwner =
      event.createdBy && event.createdBy.toString() === userId;
    const isEventAdmin =
      Array.isArray(event.eventAdmins) &&
      event.eventAdmins.some((adminId) => adminId.toString() === userId);

    if (req.user?.isAdmin || isOwner || isEventAdmin) {
      return next();
    }

    return res
      .status(403)
      .json({ message: "You do not have permission to manage this event" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default eventAdmin;
