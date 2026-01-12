const walletTxnSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet"
    },

    type: {
      type: String,
      enum: ["credit", "debit"]
    },

    amount: Number,
    reason: String,
    referenceId: String
  },
  { timestamps: true }
);
