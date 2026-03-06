const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const mongoose = require("mongoose");

exports.getOrCreateConversation = async (req, res) => {
  try {

    const { receiverId, receiverModel } = req.body;

    if (!receiverId || !receiverModel) {
      return res.status(400).json({
        message: "receiverId and receiverModel are required"
      });
    }

    const senderId = req.user._id;
    const senderModel = (req.user.role === "admin" || req.user.role === "subadmin") ? "Admin" : "User";

    const ids = [senderId.toString(), receiverId.toString()].sort();
    const participantsKey = ids.join("_");

    let conversation = await Conversation.findOne({ participantsKey });

    if (!conversation) {

      /* User → Admin chat = Support Chat */
      const isSupportChat = receiverModel === "Admin";

      conversation = await Conversation.create({

        participantsKey,

        participants: [
          {
            participantId: senderId,
            participantModel: senderModel
          },
          {
            participantId: receiverId,
            participantModel: receiverModel
          }
        ],

        isSupportChat,

        assignedAdmin: receiverModel === "Admin" ? receiverId : null

      });

    }

    return res.json(conversation);

  } catch (error) {

    console.error("getOrCreateConversation error:", error);

    return res.status(500).json({
      message: "Failed to create conversation"
    });

  }
};

exports.sendMessage = async (req, res) => {
  try {

    const { conversationId, content } = req.body;

    if (!conversationId) {
      return res.status(400).json({ message: "conversationId required" });
    }

    const senderModel = req.user.role === "admin" ? "Admin" : "User";

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const isParticipant = conversation.participants.some(
      p => p.participantId.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ message: "Not allowed in this conversation" });
    }

    const media = [];

    if (req.files?.length) {

      req.files.forEach(file => {

        let type = "document";

        if (file.mimetype.startsWith("image")) type = "image";
        else if (file.mimetype.startsWith("video")) type = "video";
        else if (file.mimetype.startsWith("audio")) type = "audio";

        media.push({
          type,
          filename: file.filename
        });

      });

    }

    const message = await Message.create({
      conversation: conversationId,
      sender: {
        senderId: req.user._id,
        senderModel
      },
      content,
      media
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    res.status(201).json(message);

  } catch (error) {

    console.error("sendMessage error:", error);

    res.status(500).json({
      message: "Failed to send message"
    });

  }
};


exports.getMessages = async (req, res) => {
  try {

    const { conversationId } = req.params;

    const messages = await Message.find({
      conversation: conversationId
    })
      .populate("sender.senderId", "firstName lastName profilePic")
      .sort({ createdAt: 1 });

    res.json(messages);

  } catch (error) {

    res.status(500).json({ message: "Failed to fetch messages" });

  }
};


exports.getMyChats = async (req, res) => {
  try {

    const chats = await Conversation.find({
      "participants.participantId": req.user._id
    })
      .populate({
        path: "participants.participantId",
        select: "firstName lastName profilePic email"
      })
      .populate({
        path: "lastMessage"
      })
      .sort({ updatedAt: -1 });

    res.json(chats);

  } catch (error) {

    res.status(500).json({ message: "Failed to fetch chats" });

  }
};

exports.getSupportInbox = async (req, res) => {
  try {

    const adminId = req.user._id;

    const conversations = await Conversation.find({
      isSupportChat: true,
      assignedAdmin: adminId
    })
      .populate({
        path: "participants.participantId",
        select: "firstName lastName profilePic email"
      })
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender.senderId",
          select: "firstName lastName profilePic"
        }
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    const formatted = conversations.map(conv => {

      const user = conv.participants.find(
        p => p.participantModel === "User"
      );

      return {
        conversationId: conv._id,
        user: user ? user.participantId : null,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt
      };

    });

    res.json(formatted);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Failed to fetch support inbox"
    });

  }
};