// middleware/adminMiddleware.js
// Blocks non-admin users from all /api/admin/* routes.

const ADMIN_ROLES = ["admin", "super_admin", "superadmin"];

module.exports = (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase();
  if (!ADMIN_ROLES.includes(role))
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin privileges required."
    });
  next();
};