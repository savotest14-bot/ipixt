const mongoose = require("mongoose");

const commissionTransactionSchema = new mongoose.Schema(
  {
    commissionType: {
      type: String,
      enum: ["request_purchase", "direct_purchase"],
      required: true
    },

    commissionSource: {
      type: String,
      enum: ["media_request", "direct_order"],
      required: true
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    baseAmount: {
      type: Number, // price
      required: true
    },

    commissionAmount: {
      type: Number,
      required: true
    },

    commissionConfig: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true
      },
      value: {
        type: Number,
        required: true
      }
    },

    status: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending"
    },

    paidAt: Date,
    refundedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "CommissionTransaction",
  commissionTransactionSchema
);


// await CommissionTransaction.create({
//   commissionType: "direct_purchase",
//   commissionSource: "direct_order",
//   sourceId: order._id,
//   buyer: buyerId,
//   seller: sellerId,
//   baseAmount: price,
//   commissionAmount: platformFee,
//   commissionConfig: commission.directPurchaseCommission,
//   status: "paid"
// });