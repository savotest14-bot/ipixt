const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(401).json({
          message: "Unauthorized: user not found"
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: "Access denied: insufficient permissions"
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Role verification failed",
        error: error.message
      });
    }
  };
};

module.exports = checkRole;
