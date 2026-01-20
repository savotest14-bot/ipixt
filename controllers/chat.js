const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const mongoose = require("mongoose");


exports.getOrCreateConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] },
      isGroup: false
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, userId]
      });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: "Failed to create conversation" });
  }
};


exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, content, receiverId } = req.body;

    if (!conversationId || !receiverId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const media = [];

    if (req.files?.length) {
      req.files.forEach(file => {
        media.push({
          type: file.mimetype.startsWith("image")
            ? "image"
            : file.mimetype.startsWith("video")
            ? "video"
            : file.mimetype.startsWith("audio")
            ? "audio"
            : "document",
          filename: file.filename
        });
      });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content,
      media
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id
    });

    const io = req.app.get("io");
    io.emit("send-message", {
      messageId: message._id,
      receiverId
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};


exports.getMyChats = async (req, res) => {
  try {
    const chats = await Conversation.find({
      participants: req.user._id
    })
      .populate("participants", "firstName lastName profilePic")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "firstName lastName profilePic" }
      })
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};


exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation: conversationId
    })
      .populate("sender", "firstName lastName profilePic")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

exports.markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        seenBy: { $ne: req.user._id }
      },
      { $addToSet: { seenBy: req.user._id } }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark as seen" });
  }
};
