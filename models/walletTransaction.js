const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    balanceAfter: {
      type: Number,
      required: true
    },

    reason: {
      type: String,
      enum: [
        "seller_earning",
        "seller_commission",
        "cashout",
        "refund"
      ],
      required: true
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
