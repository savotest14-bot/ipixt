const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },

    sender: {
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "sender.senderModel"
      },
      senderModel: {
        type: String,
        required: true,
        enum: ["User", "Admin"]
      }
    },

    content: String,

    media: [
      {
        type: {
          type: String,
          enum: ["image", "video", "audio", "document"]
        },
        filename: String
      }
    ],

    seenBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "seenBy.userModel"
        },
        userModel: {
          type: String,
          enum: ["User", "Admin"]
        }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);