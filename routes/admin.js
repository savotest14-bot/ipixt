const express = require("express");
const router = express.Router();
const {
  adminLogin,
  logout,
  forgotPassword,
  resetPassword,
} = require("../controllers/admin");
const {
  userLogin,
  forgotPasswordValidation,
  setPasswordValidation,
} = require("../validations/validator");
const validate = require("../middlewares/validate");

router.post("/signin", validate(userLogin), adminLogin);
router.post("/signout", logout);
router.post(
  "/forgot-password",
  validate(forgotPasswordValidation),
  forgotPassword
);
router.post(
  "/reset-password/:token",
  validate(setPasswordValidation),
  resetPassword
);

module.exports = router;
