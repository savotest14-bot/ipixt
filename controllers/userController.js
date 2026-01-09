const {
  humanize,
  generateOTP,
  hashOTP,
  verifyOTP,
  compareOTP,
  verifyHashOTP,
} = require("../functions/commons");
const { generateToken } = require("../utils/jwt");
const { sendMail } = require("../functions/mailer");
// const { OAuth2Client } = require("google-auth-library");
const mongoose = require("mongoose");
const moment = require("moment");
const User = require("../models/users");
// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const jwt = require("jsonwebtoken");
// const twilioClient = require("../functions/twilo");
// const ALLOWED_PHONE = "+12175831693";


exports.register = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body || {};

    if (!email && !phoneNumber) {
      return res.status(400).send({ message: "Email or phone is required" });
    }

    let query = {};
    if (email) query.email = email.toLowerCase().trim();
    if (phoneNumber) query.phoneNumber = phoneNumber.trim();

    let existing = await User.findOne({
      $or: [
        { email: email ? email.toLowerCase().trim() : null },
        { phoneNumber: phoneNumber ? phoneNumber.trim() : null }
      ]
    });

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    if (existing) {
      if (existing.isVerified) {
        return res.status(400).send({
          message:
            "User already registered. Please login or use another email/phone.",
        });
      } else {
        existing.otp = hashedOTP;
        existing.otpExpiry = otpExpiry;
        await existing.save();

        const mailVariable = {
          "%otp%": otp,
          "%email%": email || "",
          "%phone%": phoneNumber || "",
        };

        if (email) sendMail("send-otp", mailVariable, email);
        // if (phoneNumber) await sendSMSOTP(phoneNumber, otp);

        return res.status(200).json({
          message: `OTP sent successfully to ${email || phoneNumber}`,
          userId: existing._id,
        });
      }
    }

    const user = await User.create({
      email: email?.toLowerCase().trim() || null,
      phoneNumber: phoneNumber?.trim() || null,
      otp: hashedOTP,
      otpExpiry,
      isVerified: false,
      role: "USER",
    });

    const mailVariable = {
      "%otp%": otp,
      "%email%": email || "",
      "%phone%": phoneNumber || "",
    };

    if (email) await sendMail("send-otp", mailVariable, email);
    // if (phoneNumber) await sendSMSOTP(phoneNumber, otp);

    return res.status(201).json({
      message: `OTP sent successfully to ${email || phoneNumber}`,
      userId: user._id,
      otp: otp
    });
  } catch (error) {
    console.log("register-error", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.verifyPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber, otp, email } = req.body;

    if (!phoneNumber && !email) {
      return res.status(400).json({ message: "Please enter phone or email" });
    }
    let user;
    if (phoneNumber) {
      user = await User.findOne({ phoneNumber, isDeleted: false });
    } else if (email) {
      user = await User.findOne({ email, isDeleted: false });
    }

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found please sign up first." });
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    const isValid = await compareOTP(otp, user.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    const token = jwt.sign(
      { _id: user._id, phoneNumber: user.phoneNumber },
      process.env.JWT_SECRET,
      { expiresIn: "5d" }
    );

    await User.updateOne(
      { _id: user._id },
      {
        $set: { isVerified: true },
        $unset: { otp: "", otpExpiry: "" },
        $push: { tokens: token },
      }
    );

    res.cookie("user_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: "OTP verified successfully",
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser?.isVerified) {
      return res.status(400).send({ message: "User already exists" });
    }
    if (existingUser) {
      await User.deleteOne({ _id: existingUser._id });
    }

    const otp = generateOTP();

    let obj = {
      firstName: humanize(firstName),
      lastName: humanize(lastName),
      email,
      password,
      otp: await hashOTP(otp),
      otpExpiry: moment()
        .add(10, "minutes")
        .utc()
        .format("YYYY-MM-DDTHH:mm:ss.SSS[Z]"),
    };

    const mailVariable = {
      "%fullName%": `${obj.firstName} ${obj.lastName}`,
      "%otp%": otp,
    };

    const users = await User.create(obj);

    sendMail("otp-verify", mailVariable, users.email);

    return res
      .status(201)
      .send({ data: users._id, message: "User Registered Successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
}; 

exports.verifyOTP = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const { otp } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ message: "Invalid user id" });
    }

    const user = await User.findById(userId).lean(true);
    if (!user) return res.status(404).send({ message: "User not found" });

    if (!user.otp || moment().isAfter(user.otpExpiry)) {
      return res.status(400).send({
        message: "OTP has expired or invalid. Please request a new one.",
      });
    }

    const isValid = await verifyHashOTP(otp, user.otp);
    if (!isValid) {
      return res.status(400).send({ message: "Invalid OTP" });
    }

    await User.updateOne(
      { _id: userId },
      {
        $set: { isVerified: true },
        $unset: { otp: 1, otpExpiry: 1 },
      }
    );

    return res.status(200).send({ id: userId, message: "Otp verified successfully" });

  } catch (error) {
    console.log("verify-error", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const { id, newPassword, confirmPassword } = req.body;

    if (!id || !newPassword || !confirmPassword) {
      return res.status(400).send({
        message: "id, newPassword and confirmPassword are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).send({
        message: "New password and confirm password do not match",
      });
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).send({
        message:
          "Password must contain minimum 8 characters, including uppercase, lowercase, number & special character",
      });
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(400).send({
        message: "Please verify OTP before setting password",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).send({
      message: "Password created successfully",
    });
  } catch (error) {
    console.log("set-password-error", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if ((!email && !phoneNumber)) {
      return res.status(400).json({
        message: "Email or phone, are required",
      });
    }

    const query = email ? { email } : { phoneNumber };
    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(400).json({
        message: "User not found.",
      });
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    await User.updateOne(
      query,
      {
        $set: { otp: hashedOTP, otpExpiry },
      }
    );

    const mailVariable = {
      "%otp%": otp,
      "%email%": email || "",
      "%phone%": phoneNumber || "",
    };

    if (email) await sendMail("send-otp", mailVariable, email);
    // if (phoneNumber) await sendSMSOTP(phoneNumber, otp);

    return res.status(200).json({
      id: user._id,
      message: "Otp sent successfully",
    });

  } catch (error) {
    console.error("reset-password-error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.resendOTP = async (req, res) => {
  try {

    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ message: "User id is required" });
    }

    const user = await User.findOne(
      { _id: req.params.id },
      { email: 1 }
    ).lean(true);

    if (!user) {
      return res.status(400).send({ message: "Invalid User" });
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    const mailVariable = {
      "%otp%": otp,
    };

    if (user.email) sendMail("send-otp", mailVariable, user.email);

    await User.updateOne(
      { _id: req.params.id },
      {
        $set: {
          otp: hashedOTP,
          otpExpiry: otpExpiry
        },
      }
    );

    return res.status(200).send({ otp: otp, message: "Otp sent successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, phoneNumber, password } = req.body;

    const user = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    })
      .select("+password")
      .lean();

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).send({
        message: "Password not set. Please create a password first.",
      });
    }

    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).send({ message: "Incorrect password" });
    }


    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
   await User.updateOne({ _id: admin._id }, { $unset: { otp: "", otpExpires: "" }, $push: { tokens: token } });
   
    return res.status(200).send({
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("login-error", err);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.dashboard = async (req, res) => {
  try {
    const users = await User.findOne({ _id: req.user._id }).lean(true);

    return res.send({
      data: users,
      message: `Welcome ${users.firstName} ${users.lastName}`,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.logout = async (req, res) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(400).json({ message: "No token found" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
      await User.updateOne({ _id: decoded._id }, { $pull: { tokens: token } });

      res.clearCookie("token", { path: "/" });

      return res.json({ message: "Logged out successfully" });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  });
};