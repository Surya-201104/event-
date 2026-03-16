const admin = (req, res, next) => {
  const isSystemAdmin =
    req.user && (req.user.isAdmin === true || req.user.role === "admin");

  if (isSystemAdmin) {
    return next();
  }

  return res.status(401).json({ message: "Admin access required" });
};

export default admin;
