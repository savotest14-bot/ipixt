const withdrawRequestSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    amount: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },

    processedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("WithdrawRequest", withdrawRequestSchema);
