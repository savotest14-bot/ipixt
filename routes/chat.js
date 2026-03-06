const express = require("express");
const router = express.Router();

const chatController = require("../controllers/chat");
const { authenticate } = require("../middlewares/authentication");
const { upload } = require("../middlewares/upload");

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

module.exports = router;
