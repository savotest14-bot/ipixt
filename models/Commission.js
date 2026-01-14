const mongoose = require("mongoose");

const commissionSchema = new mongoose.Schema(
  {
    requestPurchaseCommission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true,
      },
      value: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    directPurchaseCommission: {
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true,
      },
      value: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

commissionSchema.index({}, { unique: true });

module.exports = mongoose.model("Commission", commissionSchema);
