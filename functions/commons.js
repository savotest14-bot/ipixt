const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

module.exports.humanize = (str) => {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ");
};

module.exports.generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

module.exports.generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

module.exports.hashOTP = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(otp.toString(), salt);
};

module.exports.verifyHashOTP = async (plainOTP, hashedOTP) => {
  return await bcrypt.compare(plainOTP, hashedOTP);
};

module.exports.compareOTP = async (plainOTP, hashedOTP) => {
  return await bcrypt.compare(plainOTP, hashedOTP);
};


module.exports.deleteFileSafe = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

const NotificationSettings = require("../models/NotificationSettings");

module.exports.canSendNotification = async (userId, key) => {
  const settings = await NotificationSettings.findOne({ user: userId });

  if (!settings) return true; 
  
  if (typeof settings[key] !== "boolean") return true;

  return settings[key];
};


