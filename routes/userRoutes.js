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
  verifyPhoneNumber,
  setPassword,
  resetPassword,
  savePersonalAndKycDetails,
  updateUserCategoriesAndRole,
  getMyProfile,
  updateProfilePic,
  changePassword,
  updateUserPersonalDetails,
  getUserProfileById,
  toggleFollow,
  getFollowers,
  getFollowing,
  getFollowBackUsers,
  toggleFavorite,
  getMyFavoriteItems,
  upsertUserAddress,
  getItemByPublicToken,
  getSocialSuggestions,
  notificationSettings,
  switchRole,
  downloadImage,

} = require("../controllers/userController");

const {
  userValidation,
  userLogin,
  verifyOTPValidation,
  setPasswordValidation,
  resetPasswordValidation,
  personalKycSchema,
  changePasswordValidation,
  
} = require("../validations/validator");
const validate = require("../middlewares/validate");
const { authenticate } = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");
const { getAllCategories, getSubCategoriesByCategory } = require("../controllers/category");
const { upload } = require("../middlewares/upload");
const { getCommissionForUser } = require("../controllers/commission");


// authentication


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

// end
router.get("/item/:token", getItemByPublicToken);

// User Common Routes

router.put("/personal-kyc", authenticate, validate(personalKycSchema), savePersonalAndKycDetails);
router.get("/getAllCategories", authenticate, getAllCategories);
router.put("/update-role", authenticate,  updateUserCategoriesAndRole);
router.get("/getMyProfile", authenticate, getMyProfile);
router.patch("/updateProfilePic", authenticate, upload.single("profilePic"), updateProfilePic);
router.put("/updateUserPersonalDetails", authenticate, updateUserPersonalDetails);
router.patch("/changePassword", authenticate, validate(changePasswordValidation), changePassword);
router.get("/getUserProfile/:userId", authenticate, getUserProfileById);
router.post("/toggleFollow/:userId", authenticate, toggleFollow);
router.get("/getFollowers/:userId", authenticate, getFollowers);
router.get("/getFollowings/:userId", authenticate, getFollowing);
router.get("/getFollowBackUsers", authenticate, getFollowBackUsers);
router.get("/getSocialSuggestions", authenticate, getSocialSuggestions);
router.post("/toggleFavorite/:itemId", authenticate, toggleFavorite);
router.get("/getMyFavoriteItems", authenticate, getMyFavoriteItems);
router.put("/updateLocation", authenticate, upsertUserAddress);
router.get("/commission", authenticate, getCommissionForUser);
router.patch("/notifications/settings", authenticate, notificationSettings);
router.post("/switch-role", authenticate, switchRole);
router.get("/download/original/:folder/:filename", authenticate,  downloadImage);
router.get("/getSubCategoryByCategoryId/:categoryId", getSubCategoriesByCategory);

module.exports = router;