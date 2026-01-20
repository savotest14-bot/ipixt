const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const { canSendNotification } = require("./functions/commons");

const onlineUsers = new Map(); // userId -> socketId

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    /* ---------------- USER ONLINE ---------------- */
    socket.on("user-online", (userId) => {
      onlineUsers.set(userId.toString(), socket.id);
      io.emit("user-status", { userId, online: true });
    });

    /* ---------------- USER OFFLINE ---------------- */
    socket.on("disconnect", () => {
      for (let [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          io.emit("user-status", { userId, online: false });
        }
      }
    });

    /* ---------------- TYPING INDICATOR ---------------- */
    socket.on("typing", ({ conversationId, receiverId }) => {
      const receiverSocket = onlineUsers.get(receiverId.toString());
      if (receiverSocket) {
        io.to(receiverSocket).emit("typing", { conversationId });
      }
    });

    socket.on("stop-typing", ({ conversationId, receiverId }) => {
      const receiverSocket = onlineUsers.get(receiverId.toString());
      if (receiverSocket) {
        io.to(receiverSocket).emit("stop-typing", { conversationId });
      }
    });

    /* ---------------- SEND MESSAGE (TEXT / MEDIA) ---------------- */
    socket.on("send-message", async ({ messageId, receiverId }) => {
      try {
        const receiverSocket = onlineUsers.get(receiverId.toString());

        // ✔✔ DELIVERED (receiver online)
        if (receiverSocket) {
          io.to(receiverSocket).emit("receive-message", { messageId });

          socket.emit("message-status", {
            messageId,
            status: "delivered"
          });
        }
        // 🔔 OFFLINE → SEND NOTIFICATION
        else {
          const allowed = await canSendNotification(
            receiverId,
            "chat.chatNotifications"
          );

          if (allowed) {
            console.log("🔔 Send push notification to:", receiverId);
            // push / email logic here
          }
        }

      } catch (err) {
        console.error("send-message error:", err);
      }
    });

    /* ---------------- MESSAGE SEEN (BLUE TICK) ---------------- */
    socket.on("message-seen", async ({ conversationId, userId }) => {
      try {
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            seenBy: { $ne: userId }
          },
          { $addToSet: { seenBy: userId } }
        );

        const conversation = await Conversation.findById(conversationId);

        conversation.participants.forEach((participant) => {
          if (participant.toString() !== userId.toString()) {
            const senderSocket = onlineUsers.get(participant.toString());
            if (senderSocket) {
              io.to(senderSocket).emit("message-status", {
                conversationId,
                status: "seen"
              });
            }
          }
        });

      } catch (err) {
        console.error("message-seen error:", err);
      }
    });
  });
};
