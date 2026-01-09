const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    address: {
      type: {
        streetAddress: {
          type: String,
        },
        city: {
          type: String,
        },
        state: {
          type: String,
        },
        country: {
          type: String,
        },
        zipCode: {
          type: Number,
        },
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      default: "active",
    },
    phoneNumber: {
      type: String,
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    tokens: {
      type: [String],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);