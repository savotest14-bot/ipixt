const express = require("express");
const router = express.Router();
const {
  createUser,
  login,
  verifyOTP,
  dashboard,
  logout,
  resendOTP,
  register,
  userGoogleLogin,
  phoneNumberLogin,
  verifyPhoneNumber,
  setPassword,
  resetPassword,
} = require("../controllers/userController");

const {
  userValidation,
  userLogin,
  verifyOTPValidation,
  setPasswordValidation,
  resetPasswordValidation,
} = require("../validations/validator");
const validate = require("../middlewares/validate");
const { authenticate } = require("../middlewares/authentication");

router.post("/register", validate(userValidation), register);
// router.post("/auth/google-login", userGoogleLogin);
// router.post("/auth/phone-email-login", phoneNumberLogin);
router.post("/auth/phone-email-verify", verifyPhoneNumber);
router.post("/verify-otp/:id", validate(verifyOTPValidation), verifyOTP);
router.post("/resend-otp/:id", resendOTP);
router.post("/set-password", validate(setPasswordValidation), setPassword);
router.post("/reset-password", validate(resetPasswordValidation), resetPassword);

router.post("/login", validate(userLogin), login);
router.get("/dashboard", authenticate, dashboard);
router.post("/logout", logout);

module.exports = router;