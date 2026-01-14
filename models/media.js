const mongoose = require("mongoose");

const mediaRequestSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    contentType: {
      type: String,
      enum: ["image", "video", "audio", "document"],
      required: true
    },

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
      }
    ],

    locationType: {
      type: String,
      enum: ["indoor", "outdoor", "studio", "any"],
      default: "any"
    },

    scheduledAt: {
      type: Date,
      required: true
    },

    description: {
      type: String,
      maxlength: 1000
    },

    requestCharge: {
      type: Number,
      required: true,
      min: 0
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
    },
    sellerResponse: {
      type: String,
      maxlength: 500
    },

    isPaid: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MediaRequest", mediaRequestSchema);
