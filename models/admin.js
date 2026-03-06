const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  adminKey: String,
  profilePic: String,
  email: { type: String },
  password: { type: String },
  phone: { type: String },
  role: {
    type: String,
    enum: ["admin", "subadmin"],
    default: "admin"
  },
  permissions: {
    type: [String],
    default: []
  },
  facebookLink: { type: String },
  instagramLink: { type: String },
  twitterLink: { type: String },
  linkedinLink: { type: String },
  bio: { type: String },
  otp: String,
  otpExpires: Date,
  tokens: {
    type: [String],
  },
  otpVerified: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Admin", AdminSchema);
