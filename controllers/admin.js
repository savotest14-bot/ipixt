const mongoose = require("mongoose");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail } = require("../functions/mailer");

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .send({ message: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).send({ message: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(400).send({ message: "Incorrect password" });
    }

    const token = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    await Admin.updateOne(
      { _id: admin._id },
      { $unset: { otp: "", otpExpires: "" }, $push: { tokens: token } }
    );
    return res.status(200).send({ message: "Login successful", token });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Server error" });
  }
};

exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(400).send({ message: "No token found" });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    console.log(token);
    if (!token) {
      return res.status(400).send({ message: "Invalid token format" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Invalid or expired token" });
      }
      try {
        await Admin.updateOne(
          { _id: decoded.userId },
          { $pull: { tokens: token } }
        );
        return res.status(200).send({ message: "Logged out successfully" });
      } catch (error) {
        return res.status(500).send({ message: error.message });
      }
    });
  } catch (error) {
    return res.status(500).send({ message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).send({ message: "Admin not found" });
    }
    const resetToken = crypto.randomBytes(32).toString("hex");

    admin.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    admin.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await admin.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await sendMail("otp-verify", { "{{RESET_LINK}}": resetLink }, admin.email);

    return res.status(200).send({
      message: "Password reset code sent to email",
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).send({ message: "Password is required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).send({
        message: "Invalid or expired token",
      });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;

    admin.tokens = [];

    await admin.save();

    return res.status(200).send({
      message: "Password reset successful. Please login again.",
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
