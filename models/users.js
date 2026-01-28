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
    isPasswordSet: {
      type: Boolean,
      default: false,
    },
    role: {
      enum: ["buyer", "seller", "both"],
      type: String,
      default: null,
    },
    followersCount: {
      type: Number,
      default: 0
    },
    followingCount: {
      type: Number,
      default: 0
    },
    tokens: {
      type: [String],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    address: {
      latitude: {
        type: Number,
      },
      longitude: {
        type: Number,
      },
      address: {
        type: String,
        trim: true,
      },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },

    profilePic: {
      type: String,
      default: null
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

userSchema.index(
  { countryCode: 1, phoneNumber: 1 },
  { unique: true }
);

userSchema.index({ location: "2dsphere" });


userSchema.virtual("profileCompletion").get(function () {
  let completed = 0;
  let total = 9;

  if (this.firstName) completed++;
  if (this.lastName) completed++;

  if (this.email || (this.phoneNumber && this.countryCode)) completed++;

  if (this.profilePic) completed++;
  if (this.dob) completed++;
  if (this.country) completed++;

  if (this.categories?.length) completed++;

  if (
    (this.role === "seller" || this.role === "both") &&
    this.businessName
  ) {
    completed++;
  }

  if (this.isKycCompleted) completed++;

  return Math.round((completed / total) * 100);
});



userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);