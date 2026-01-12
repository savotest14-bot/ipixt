const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const e = require("express");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      lowercase: true,
    },
    password: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    country: {
      type: String,
    },
    businessName: String,
    businessId: String,
    currency: String,
    dob: Date,
    kyc: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isKycCompleted: {
      type: Boolean,
      default: false,
    },
    countryCode: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: "active",
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      }
    ],
    role: {
      enum: ["buyer", "seller", "both"],
      type: String,
      default: null,
    },
    tokens: {
      type: [String],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userSchema.index(
  { countryCode: 1, phoneNumber: 1 },
  { unique: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);