const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/authentication");
const { createItemWithQr, getMyItems, getItemById, softDeleteItem, getIncomingMediaRequests, updateMediaRequestStatus } = require("../controllers/seller");
const { upload } = require("../middlewares/upload");
const checkRole = require("../middlewares/checkRole");

router.post("/uploadMedia", authenticate, checkRole("seller", "both"),
  upload.fields([
    { name: "mediaPhoto", maxCount: 6 },
    { name: "mediaVideo", maxCount: 6 },
    { name: "mediaAudio", maxCount: 6 },
    { name: "mediaDocument", maxCount: 6 },
  ]), createItemWithQr);

router.get("/getMyItems", authenticate, checkRole("seller", "both"), getMyItems)
router.get("/getItem/:itemId", authenticate, checkRole("seller", "both"), getItemById)
router.patch("/deleteItem/:itemId", authenticate, checkRole("seller", "both"), softDeleteItem)
router.get("/getIncomingMediaRequests", authenticate, checkRole("seller", "both"), getIncomingMediaRequests);
router.put("/updateMediaRequestStatus/:requestId", authenticate, checkRole("seller", "both"), updateMediaRequestStatus);


module.exports = router;