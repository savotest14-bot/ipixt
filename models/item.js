const itemSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    title: String,
    description: String,
    price: Number,
    currency: String,
     publicToken: {
      type: String,
      unique: true,
      index: true
    },

    images: [String],
    videos: [String],

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);
