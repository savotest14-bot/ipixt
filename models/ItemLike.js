const mongoose = require("mongoose");

const itemLikeSchema = new mongoose.Schema(
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
    }
  },
  { timestamps: true }
);

itemLikeSchema.index({ item: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("ItemLike", itemLikeSchema);
