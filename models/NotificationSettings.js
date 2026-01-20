const mongoose = require("mongoose");

const notificationSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true
    },

    likes: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    shares: { type: Boolean, default: true },
    reactions: { type: Boolean, default: true },

    latestUploads: { type: Boolean, default: false },

    achievementAlerts: { type: Boolean, default: true },
    recognitionAlerts: { type: Boolean, default: true },

    salesNotifications: { type: Boolean, default: true },


    contentDiscovery: { type: Boolean, default: true },
    followActivity: { type: Boolean, default: true },


    chatNotifications: { type: Boolean, default: true }

  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "NotificationSettings",
  notificationSettingsSchema
);
