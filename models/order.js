const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true
    },

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

    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },

    contentType: {
      type: String,
      enum: ["image", "video", "audio", "document"]
    },

    basePrice: {
      type: Number,
      required: true
    },

    buyerCommission: {
      type: Number,
      required: true
    },

    sellerCommission: {
      type: Number,
      required: true
    },

    amountPaid: {
      type: Number,
      required: true // basePrice + buyerCommission
    },

    sellerEarning: {
      type: Number,
      required: true // basePrice - sellerCommission
    },

    currency: {
      type: String,
      default: "USD"
    },

    paymentMethod: {
      type: String,
      enum: ["card", "paypal", "applepay", "googlepay", "bank"]
    },

    paymentGateway: {
      type: String,
      enum: ["stripe", "razorpay", "paypal"]
    },

    paymentId: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["paid", "refunded", "failed"],
      default: "paid"
    },

    receiptUrl: String,

    refundedAt: Date
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
