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
  createSubAdmin,
  updateSubAdmin,
  getAllSubAdmins,
  getSubAdminById,
  updateSubAdminPermissions,
  deleteSubAdmin,
} = require("../controllers/admin");
const {
  userLogin,
  forgotPasswordValidation,
  setAdminPasswordValidation,
  changePasswordValidation,
  verifyOTPValidation,
} = require("../validations/validator");

const chatController = require("../controllers/chat")
const validate = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { upload } = require("../middlewares/upload");
const checkRole = require("../middlewares/checkRole");
const { upsertCommission, getCommission } = require("../controllers/commission");
const { checkPermission } = require("../middlewares/checkPermission");

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

router.get("/getAllUsers", authenticate, checkPermission("users_view"), getAllUsers);
router.get("/getUser/:userId", authenticate, checkPermission("users_view"), getUserById);
router.patch("/deleteUser/:userId", authenticate, checkPermission("users_delete"), toggleUserDeleteStatus);
router.patch("/blockUser/:userId", authenticate,checkPermission("users_delete"), toggleUserStatus);
router.patch("/updateUser/:userId", authenticate, checkPermission("users_edit"), upload.single("profilePic"), adminUpdateUser);
router.get("/getItemsBySellerId/:sellerId", authenticate, getItemsBySellerId);
router.get("/getAllItems", authenticate, getAllItemsForAdmin);
router.get("/getItemById/:itemId", authenticate, getItemByIdForAdmin);
router.patch("/approval/:userId", authenticate, updateApprovalStatus);
router.patch("/seller-request/:userId", authenticate, reviewSellerRequest);
router.get("/pending-sellers", authenticate, getPendingSellerApprovals);
router.get("/pending-buyer-seller-requests", authenticate, getPendingBuyerSellerRequests);
router.post("/create-subadmin", authenticate, createSubAdmin);
router.put("/updateSubadmin/:id", authenticate, updateSubAdmin);
router.get("/getAllSubadmins", authenticate, getAllSubAdmins);
router.get("/getSubadminById/:id", authenticate, getSubAdminById);
router.patch("/updatePermissions/:id", authenticate, updateSubAdminPermissions);
router.delete("/deleteSubadmin/:id", authenticate, deleteSubAdmin);

router.post(
  "/conversation",
  authenticate,
  chatController.getOrCreateConversation
);

router.post(
  "/messages",
  authenticate,
  upload.array("chatMedia", 10),
  chatController.sendMessage
);

router.get(
  "/messages/:conversationId",
  authenticate,
  chatController.getMessages
);


router.get(
  "/getChats",
  authenticate ,
  chatController.getMyChats
);

router.get("/getAllConversation", authenticate, chatController.getSupportInbox);

module.exports = router;
