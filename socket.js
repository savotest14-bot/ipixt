const Message = require("./models/Message");
const Conversation = require("./models/Conversation");

const onlineUsers = new Map();

module.exports = (io) => {

  io.on("connection", (socket) => {

    console.log("Socket connected:", socket.id);

    /* USER ONLINE */

    socket.on("user-online", ({ userId }) => {

      socket.userId = userId;

      const sockets = onlineUsers.get(userId) || [];

      sockets.push(socket.id);

      onlineUsers.set(userId, sockets);

      io.emit("user-status", {
        userId,
        online: true
      });

    });


    /* JOIN CONVERSATION */

    socket.on("join-conversation", (conversationId) => {

      socket.join(conversationId);

    });


    /* TYPING */

    socket.on("typing", ({ conversationId }) => {

      if (!socket.userId) return;

      socket.to(conversationId).emit("typing", {
        userId: socket.userId
      });

    });

    socket.on("stop-typing", ({ conversationId }) => {

      if (!socket.userId) return;

      socket.to(conversationId).emit("stop-typing", {
        userId: socket.userId
      });

    });


    /* SEND MESSAGE */

    socket.on("send-message", async ({ messageId, conversationId }) => {

      try {

        const message = await Message.findById(messageId)
          .populate("sender.senderId", "firstName lastName profilePic");

        if (!message) return;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation) return;

        io.to(conversationId).emit("receive-message", message);

        const receivers = conversation.participants.filter(
          p => p.participantId.toString() !== socket.userId
        );

        for (const receiver of receivers) {

          const sockets = onlineUsers.get(receiver.participantId.toString()) || [];

          sockets.forEach(socketId => {

            io.to(socketId).emit("message-status", {
              messageId,
              status: "delivered"
            });

          });

        }

      } catch (err) {

        console.error("send-message error:", err);

      }

    });


    /* MESSAGE SEEN */

    socket.on("message-seen", async ({ conversationId }) => {

      try {

        const messages = await Message.find({
          conversation: conversationId,
          "sender.senderId": { $ne: socket.userId },
          "seenBy.userId": { $ne: socket.userId }
        });

        const messageIds = messages.map(m => m._id);

        await Message.updateMany(
          { _id: { $in: messageIds } },
          {
            $addToSet: {
              seenBy: {
                userId: socket.userId,
                userModel: "User"
              }
            }
          }
        );

        const conversation = await Conversation.findById(conversationId);

        conversation.participants.forEach((p) => {

          if (p.participantId.toString() !== socket.userId) {

            const sockets = onlineUsers.get(p.participantId.toString()) || [];

            sockets.forEach(socketId => {

              messageIds.forEach(id => {

                io.to(socketId).emit("message-status", {
                  messageId: id,
                  status: "seen"
                });

              });

            });

          }

        });

      } catch (err) {

        console.error(err);

      }

    });


    /* DISCONNECT */

    socket.on("disconnect", () => {

      if (!socket.userId) return;

      const sockets = onlineUsers.get(socket.userId) || [];

      const filtered = sockets.filter(id => id !== socket.id);

      if (filtered.length) {

        onlineUsers.set(socket.userId, filtered);

      } else {

        onlineUsers.delete(socket.userId);

        io.emit("user-status", {
          userId: socket.userId,
          online: false
        });

      }

    });

  });

};