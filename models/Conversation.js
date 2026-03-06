const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
{
  participants: [
    {
      participantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "participants.participantModel"
      },
      participantModel: {
        type: String,
        required: true,
        enum: ["User", "Admin"]
      }
    }
  ],

  // prevents duplicate conversations
  participantsKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  isSupportChat: {
    type: Boolean,
    default: false
  },

  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null
  },

  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },

  lastMessageAt: {
    type: Date
  }

},
{ timestamps: true }
);

/* indexes for fast queries */

conversationSchema.index({ "participants.participantId": 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);