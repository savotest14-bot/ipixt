const express = require("express");
const router = express.Router();
const {
  adminLogin,
  logout,
  forgotPassword,
  resetPassword,
  getAllUsers,
  getUserById,
  toggleUserDeleteStatus,
  toggleUserStatus,
  adminUpdateUser,
  getItemsBySellerId,
  getAllItemsForAdmin,
  getItemByIdForAdmin,
  changePassword,
  verifyResetOtp,
  getAdminProfile,
  updateAdminProfile,
  reviewSellerRequest,
  updateApprovalStatus,
  getPendingSellerApprovals,
  getPendingBuyerSellerRequests,
} = require("../controllers/admin");
const {
  userLogin,
  forgotPasswordValidation,
  setAdminPasswordValidation,
  changePasswordValidation,
  verifyOTPValidation,
} = require("../validations/validator");
const validate = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { upload } = require("../middlewares/upload");
const checkRole = require("../middlewares/checkRole");
const { upsertCommission, getCommission } = require("../controllers/commission");

router.post("/signin", validate(userLogin), adminLogin);
router.post("/signout", logout);
router.post(
  "/forgot-password",
  validate(forgotPasswordValidation),
  forgotPassword
);
router.post("/verify-otp", verifyResetOtp);
router.post(
  "/reset-password",
  validate(setAdminPasswordValidation),
  resetPassword
);

router.post("/changePassword", authenticate, validate(changePasswordValidation), changePassword);
router.get("/getMyProfile", authenticate, getAdminProfile);
router.put("/updateAdminProfile", authenticate, upload.single("profilePic"), updateAdminProfile);

//commision

router.post("/commission", authenticate, upsertCommission);
router.get("/commission", authenticate, getCommission);


//end

router.get("/getAllUsers", authenticate, getAllUsers);
router.get("/getUser/:userId", authenticate, getUserById);
router.patch("/deleteUser/:userId", authenticate, toggleUserDeleteStatus);
router.patch("/blockUser/:userId", authenticate, toggleUserStatus);
router.patch("/updateUser/:userId", authenticate, upload.single("profilePic"), adminUpdateUser);
router.get("/getItemsBySellerId/:sellerId", authenticate, getItemsBySellerId);
router.get("/getAllItems", authenticate, getAllItemsForAdmin);
router.get("/getItemById/:itemId", authenticate, getItemByIdForAdmin);
router.patch("/approval/:userId", authenticate, updateApprovalStatus);
router.patch("/seller-request/:userId", authenticate, reviewSellerRequest);
router.get("/pending-sellers",  getPendingSellerApprovals);
router.get("/pending-buyer-seller-requests", getPendingBuyerSellerRequests);

module.exports = router;
