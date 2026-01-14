const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authentication");
const checkRole = require("../middlewares/checkRole");
const { getItemsForBuyer, getLatestItemsForBuyer, getItemById, addComment, toggleLike, getItemComments, getUserProfileSummary, getUserItems, requestMedia, getMyMediaRequests, getUserCollections, generateItemShareLink } = require("../controllers/buyer");

router.get("/getPosts", authenticate, checkRole("buyer", "both"), getItemsForBuyer);
router.get("/getLatestPosts", authenticate, checkRole("buyer", "both"), getLatestItemsForBuyer);
router.get("/getItemComments/:itemId", authenticate, checkRole("buyer", "both"), getItemComments);
router.get("/getItem/:itemId", authenticate, checkRole("buyer", "both"), getItemById);
router.post("/addComment/:itemId", authenticate, checkRole("buyer", "both"), addComment);
router.post("/like/:itemId", authenticate, checkRole("buyer", "both"), toggleLike);
router.get("/getUserProfileSummary/:userId", authenticate, checkRole("buyer", "both"), getUserProfileSummary);
router.get("/getUserItems/:userId", authenticate, checkRole("buyer", "both"), getUserItems);
router.get("/getUserCollections/:userId", authenticate, checkRole("buyer", "both"), getUserCollections);
router.post("/media-request", authenticate, checkRole("buyer", "both"), requestMedia);
router.get("/getMyMediaRequests", authenticate, checkRole("buyer", "both"), getMyMediaRequests);
router.post("/getSharedLink/:itemId", authenticate, checkRole("buyer", "both"), generateItemShareLink);

module.exports = router;