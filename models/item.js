const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
      }
    ],

    title: String,
    description: String,
    price: Number,
    currency: String,

    tags: {
      type: [String],
      default: [],
      index: true
    },

    format: {
      type: String,
      enum: ["physical", "digital", "service"],
      required: true
    },

    publicToken: {
      type: String,
      unique: true,
      index: true
    },

    media: [
      {
        type: {
          type: String,
          enum: ["image", "video", "audio", "document"],
          required: true
        },
        filename: {
          type: String,
          required: true
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    viewsCount: { type: Number, default: 0 },
    clicksCount: { type: Number, default: 0 },
    purchasesCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
     favoritesCount: {
      type: Number,
      default: 0
    },
    commentsCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

itemSchema.virtual("conversionRate").get(function () {
  if (!this.viewsCount) return 0;
  return Number(((this.purchasesCount / this.viewsCount) * 100).toFixed(2));
});

itemSchema.set("toJSON", { virtuals: true });
itemSchema.set("toObject", { virtuals: true });

const Item = mongoose.model("Item", itemSchema);

const itemViewSchema = new mongoose.Schema(
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

itemViewSchema.index({ item: 1, user: 1 }, { unique: true });

const ItemView = mongoose.model("ItemView", itemViewSchema);

const itemClickSchema = new mongoose.Schema(
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

itemClickSchema.index({ item: 1, user: 1 }, { unique: true });

const ItemClick = mongoose.model("ItemClick", itemClickSchema);


const itemPurchaseSchema = new mongoose.Schema(
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

    quantity: {
      type: Number,
      default: 1
    },

    amount: {
      type: Number,
      required: true
    },

    paymentId: String
  },
  { timestamps: true }
);

const ItemPurchase = mongoose.model("ItemPurchase", itemPurchaseSchema);

module.exports = {
  Item,
  ItemView,
  ItemClick,
  ItemPurchase
};
