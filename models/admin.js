const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  adminKey: String,
  email: { type: String },
  password: { type: String },
  phone: { type: String },
  otp: String,
  otpExpires: Date,
  tokens: {
    type: [String],
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Admin", AdminSchema);
