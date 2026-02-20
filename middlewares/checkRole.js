const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Unauthorized: user not found",
        });
      }

      const { role, approvalStatus, sellerRequest } = req.user;

      if (allowedRoles.includes("seller")) {

        if (role === "seller" || role === "both") {

          if (approvalStatus === "pending") {
            return res.status(401).json({
              message: "Your seller account is pending admin approval",
            });
          }

          if (approvalStatus === "rejected") {
            return res.status(401).json({
              message: "Your seller account was rejected by admin",
            });
          }

          return next(); 
        }

        if (role === "buyer") {

          if (sellerRequest?.status === "pending") {
            return res.status(401).json({
              message: "Your seller request is under review",
            });
          }

          if (sellerRequest?.status === "rejected") {
            return res.status(401).json({
              message: "Your seller request was rejected",
            });
          }

          return next();
        }
      }

      if (!allowedRoles.includes(role)) {
        return res.status(401).json({
          message: "Access denied: insufficient permissions",
        });
      }

      next();

    } catch (error) {
      return res.status(500).json({
        message: "Role verification failed",
        error: error.message,
      });
    }
  };
};

module.exports = checkRole;