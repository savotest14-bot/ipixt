const mongoose = require("mongoose");

const itemCommentSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ItemComment", itemCommentSchema);
