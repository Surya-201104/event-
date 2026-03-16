import Event from "../models/Event.js";

const organizerOnly = async (req, res, next) => {
  const role = req.user?.role;
  const isOrganizer = role === "organizer" || role === "admin";
  const isAdmin = req.user?.isAdmin === true;

  if (isOrganizer || isAdmin) {
    return next();
  }

  // backward compatibility: allow users who already manage events
  try {
    const existingManagedEvent = await Event.exists({
      $or: [{ createdBy: req.user?._id }, { eventAdmins: req.user?._id }],
    });

    if (existingManagedEvent) {
      return next();
    }
  } catch (error) {
    console.error("organizerOnly check failed:", error.message);
  }

  return res
    .status(403)
    .json({ message: "Organizer access required to manage events" });
};

export default organizerOnly;
