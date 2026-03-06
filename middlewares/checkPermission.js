exports.checkPermission = (permission) => {
  return (req, res, next) => {

    const admin = req.user;
    if (admin.role === "admin") {
      return next();
    }

    if (!admin.permissions.includes(permission)) {
      return res.status(403).json({
        message: "You dont have permissions to perform this task"
      });
    }
    next();
  };
};