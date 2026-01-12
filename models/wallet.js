const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true
    },

    balance: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);
