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
const fs = require("fs");
const path = require("path");
const UserFollow = require("../models/UserFollow");
const ItemFavorite = require("../models/ItemFavorite");
const { Item } = require("../models/item");


exports.register = async (req, res) => {
  try {
    const { email, phoneNumber, countryCode } = req.body || {};

    if (!email && !phoneNumber) {
      return res.status(400).json({
        message: "Email or phone number is required"
      });
    }

    if (phoneNumber && !countryCode) {
      return res.status(400).json({
        message: "Country code is required when phone number is provided"
      });
    }

    const orConditions = [];

    if (email) {
      orConditions.push({
        email: email.toLowerCase().trim()
      });
    }

    if (phoneNumber && countryCode) {
      orConditions.push({
        phoneNumber: phoneNumber.trim(),
        countryCode: countryCode.trim()
      });
    }

    const existing = await User.findOne({
      isDeleted: false,
      $or: orConditions
    });

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    if (existing) {
      if (existing.isVerified) {
        return res.status(400).json({
          message: "User already registered. Please login."
        });
      }

      existing.otp = hashedOTP;
      existing.otpExpiry = otpExpiry;
      await existing.save();

      if (email) {
        await sendMail("send-otp", { "%otp%": otp }, email);
      }

      return res.status(200).json({
        message: `OTP sent successfully to ${email || phoneNumber}`,
        userId: existing._id,
        otp 
      });
    }

    const user = await User.create({
      email: email ? email.toLowerCase().trim() : null,
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      countryCode: phoneNumber ? countryCode.trim() : null,
      otp: hashedOTP,
      otpExpiry,
      isVerified: false
    });

    if (email) {
      await sendMail("send-otp", { "%otp%": otp }, email);
    }

    return res.status(201).json({
      message: `OTP sent successfully to ${email || phoneNumber}`,
      userId: user._id,
      otp 
    });
  } catch (error) {
    console.error("register-error", error);
    return res.status(500).json({
      message: "Internal Server Error"
    });
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
        userId: user._id,
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

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    await User.updateOne({ _id: user._id }, { $unset: { otp: "", otpExpires: "" }, $push: { tokens: token } });
    user.isPasswordSet = true;
    await user.save();

    return res.status(200).send({
      message: "Password created successfully",
      isKycCompleted: user.isKycCompleted,
      role: user.role,
      token
    });
  } catch (error) {
    console.log("set-password-error", error);
    return res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, phoneNumber, countryCode } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({
        message: "Email or phone number is required"
      });
    }

    if (phoneNumber && !countryCode) {
      return res.status(400).json({
        message: "Country code is required when phone number is provided"
      });
    }

    const query = { isDeleted: false };

    if (email) {
      query.email = email.toLowerCase().trim();
    } else {
      query.phoneNumber = phoneNumber.trim();
      query.countryCode = countryCode.trim();
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    user.otp = hashedOTP;
    user.otpExpiry = otpExpiry;
    user.isPasswordSet = false;
    await user.save();

    const mailVariable = {
      "%otp%": otp,
      "%email%": email || "",
      "%phone%": phoneNumber || ""
    };

    if (email) {
      await sendMail("send-otp", mailVariable, email);
    }

    // if (phoneNumber) await sendSMSOTP(countryCode + phoneNumber, otp);

    return res.status(200).json({
      userId: user._id,
      otp,
      message: "OTP sent successfully"
    });
  } catch (error) {
    console.error("reset-password-error:", error);
    return res.status(500).json({
      message: "Internal Server Error"
    });
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
    const { email, phoneNumber, countryCode, password } = req.body;
  
    const query = { isDeleted: false };

    if (email) {
      query.email = email.toLowerCase();
    } else if (phoneNumber && countryCode) {
      query.phoneNumber = phoneNumber;
      query.countryCode = countryCode;
    } else {
      return res.status(400).json({
        message: "Email or phone number is required"
      });
    }

    const user = await User.findOne(query).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.password) {
      return res.status(400).json({
        message: "Password not set. Please create a password first"
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await User.updateOne(
      { _id: user._id },
      {
        $unset: { otp: "", otpExpires: "" },
        $push: { tokens: token }
      }
    );

    return res.status(200).json({
      message: "Login successful",
      isKycCompleted: user.isKycCompleted,
      role: user.role,
      isPasswordSet:user.isPasswordSet,
      token
    });
  } catch (err) {
    console.error("login-error", err);
    return res.status(500).json({
      message: "Internal Server Error"
    });
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


exports.savePersonalAndKycDetails = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      businessName,
      businessId,
      currency,
      country,
      kyc
    } = req.body;

    const [day, month, year] = req.body.dob.split("/");
    const parsedDob = new Date(`${year}-${month}-${day}`);
    await User.findByIdAndUpdate(
      req.user._id,
      {
        firstName,
        lastName,
        dob: parsedDob,
        businessName,
        businessId,
        currency,
        country,
        kyc,
        isKycCompleted: true
      },
      {
        new: true,
        runValidators: false
      }
    );

    res.status(200).json({
      message: "Personal & KYC details saved successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save personal details",
      error: error.message
    });
  }
};

exports.updateUserCategoriesAndRole = async (req, res) => {
  try {
    const { categories, role } = req.body;

    if (categories && !Array.isArray(categories)) {
      return res.status(400).json({
        message: "Categories must be an array"
      });
    }

    if (role && !["buyer", "seller", "both"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    const updateData = {};

    if (categories && categories.length) {
      updateData.$addToSet = {
        categories: { $each: categories }
      };
    }

    if (role) {
      updateData.$set = { role };
    }

    await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      message: "Categories and role updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update data",
      error: error.message
    });
  }
};


exports.upsertUserAddress = async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;

    if (
      latitude === undefined ||
      longitude === undefined ||
      !address
    ) {
      return res.status(400).json({
        message: "Latitude, longitude and address are required",
      });
    }

    if (
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return res.status(400).json({
        message: "Invalid latitude or longitude",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        address: {
          latitude,
          longitude,
          address,
        },
        location: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("address location");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Address saved successfully",
      data: user.address,
    });
  } catch (error) {
    console.error("upsert-address-error:", error);
    return res.status(500).json({
      message: "Failed to save address",
    });
  }
};



exports.getMyProfile = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await User.findById(userId)
      .select("-password -tokens")
      .populate("categories", "title");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "Profile fetched successfully",
      data: user
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};


exports.updateProfilePic = async (req, res) => {
  const userId = req.user._id;
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Profile image is required"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.profilePic) {
      const oldPath = path.join(
        process.cwd(),
        "uploads",
        "profilePics",
        user.profilePic
      );

      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    user.profilePic = req.file.filename;
    await user.save();

    res.status(200).json({
      message: "Profile picture updated successfully",
      data: {
        profilePic: user.profilePic
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update profile picture",
      error: error.message
    });
  }
};

exports.updateUserPersonalDetails = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dob,             
      businessName,
      businessId,
      currency,
      country,
      kyc,
      categories        
    } = req.body;

    const updateData = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (businessName) updateData.businessName = businessName;
    if (businessId) updateData.businessId = businessId;
    if (currency) updateData.currency = currency;
    if (country) updateData.country = country;

    if (dob) {
      const [day, month, year] = dob.split("/");
      updateData.dob = new Date(`${year}-${month}-${day}`);
    }

    if (kyc) {
      updateData.kyc = kyc;
      updateData.isKycCompleted = true;
    }

    if (categories && Array.isArray(categories)) {
      updateData.categories = categories;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "User details updated successfully",
      data: updatedUser
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user details",
      error: error.message
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Old password, new password and confirm password are required"
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match"
      });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from old password"
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const isMatch = await user.matchPassword(oldPassword); 
    if (!isMatch) {
      return res.status(400).json({
        message: "Old password is incorrect"
      });
    }

    user.password = newPassword;

    user.tokens = [];

    await user.save();

    res.status(200).json({
      message: "Password changed successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to change password",
      error: error.message
    });
  }
};


exports.toggleFollow = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        message: "You cannot follow yourself"
      });
    }

    const targetUser = await User.findById(targetUserId).select("_id isDeleted");

    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    const follow = await UserFollow.findOne({
      follower: currentUserId,
      following: targetUserId
    });

    if (follow) {
      await UserFollow.deleteOne({ _id: follow._id });

      await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: -1 }
      });

      await User.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: -1 }
      });

      return res.status(200).json({
        message: "Unfollowed successfully",
        status: "unfollowed"
      });
    } else {
        await UserFollow.create({
        follower: currentUserId,
        following: targetUserId
      });

      await User.findByIdAndUpdate(currentUserId, {
        $inc: { followingCount: 1 }
      });

      await User.findByIdAndUpdate(targetUserId, {
        $inc: { followersCount: 1 }
      });

      return res.status(200).json({
        message: "Followed successfully",
        status: "followed"
      });
    }

  } catch (error) {
    res.status(500).json({
      message: "Failed to follow user",
      error: error.message
    });
  }
};


exports.getFollowers = async (req, res) => {
  const { userId } = req.params;

  const followers = await UserFollow.find({ following: userId })
    .populate("follower", "firstName lastName profilePic")
    .sort({ createdAt: -1 });

  res.json({
    count: followers.length,
    data: followers
  });
};

exports.getFollowing = async (req, res) => {
  const { userId } = req.params;

  const following = await UserFollow.find({ follower: userId })
    .populate("following", "firstName lastName profilePic")
    .sort({ createdAt: -1 });

  res.json({
    count: following.length,
    data: following
  });
};

exports.getFollowBackUsers = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: { following: userId }
      },

      {
        $lookup: {
          from: "userfollows",
          let: { followerId: "$follower" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$follower", userId] },
                    { $eq: ["$following", "$$followerId"] }
                  ]
                }
              }
            }
          ],
          as: "alreadyFollowing"
        }
      },

      {
        $match: { alreadyFollowing: { $size: 0 } }
      },

      {
        $lookup: {
          from: "users",
          localField: "follower",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },

      {
        $match: { "user.isDeleted": false }
      },

      {
        $sort: { createdAt: -1 }
      },

      { $skip: skip },
      { $limit: limit },

      {
        $project: {
          _id: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          profilePic: "$user.profilePic",
          followersCount: "$user.followersCount",
          followsYou: { $literal: true },
          isFollowing: { $literal: false }
        }
      }
    ];

    const users = await UserFollow.aggregate(pipeline);

    res.status(200).json({
      message: "Follow back users fetched successfully",
      page,
      limit,
      count: users.length,
      data: users
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch follow back users",
      error: error.message
    });
  }
};


exports.getSocialSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const objectUserId = new mongoose.Types.ObjectId(userId);

    const result = await UserFollow.aggregate([
      {
        $facet: {
          mutualFriends: [
            { $match: { follower: objectUserId } },

            {
              $lookup: {
                from: "userfollows",
                let: { followedUserId: "$following" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$follower", "$$followedUserId"] },
                          { $eq: ["$following", objectUserId] },
                        ],
                      },
                    },
                  },
                ],
                as: "mutual",
              },
            },

            { $match: { mutual: { $ne: [] } } },

            {
              $lookup: {
                from: "users",
                localField: "following",
                foreignField: "_id",
                as: "user",
              },
            },

            { $unwind: "$user" },

            {
              $project: {
                _id: "$user._id",
                firstName: "$user.firstName",
                lastName: "$user.lastName",
                profilePic: "$user.profilePic",
              },
            },
          ],
          requestedUsers: [
            { $match: { follower: objectUserId } },

            {
              $lookup: {
                from: "users",
                localField: "following",
                foreignField: "_id",
                as: "user",
              },
            },

            { $unwind: "$user" },

            {
              $project: {
                _id: "$user._id",
                firstName: "$user.firstName",
                lastName: "$user.lastName",
                profilePic: "$user.profilePic",
              },
            },
          ],
          recommendedUsers: [
            {
              $lookup: {
                from: "userfollows",
                let: { uid: objectUserId },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $or: [
                          { $eq: ["$follower", "$$uid"] },
                          { $eq: ["$following", "$$uid"] },
                        ],
                      },
                    },
                  },
                ],
                as: "connections",
              },
            },

            { $match: { connections: { $size: 0 } } },

            { $limit: 10 },

            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                profilePic: 1,
              },
            },
          ],
        },
      },
    ]);

    return res.status(200).json({
      mutualFriends: result[0].mutualFriends,
      requestedUsers: result[0].requestedUsers,
      recommendedUsers: result[0].recommendedUsers,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch social suggestions",
      error: error.message,
    });
  }
};



exports.getUserProfileById = async (req, res) => {
  try {
    const profileUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(profileUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findOne({
      _id: profileUserId,
      isDeleted: false
    })
      .select(
        "firstName lastName profilePic country followersCount followingCount role createdAt"
      )
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (profileUserId.toString() === currentUserId.toString()) {
      return res.status(200).json({
        message: "Profile fetched successfully",
        data: {
          ...user,
          isFollowing: false,
          followsYou: false,
          isOwnProfile: true
        }
      });
    }

    const [isFollowing, followsYou] = await Promise.all([
      UserFollow.exists({
        follower: currentUserId,
        following: profileUserId
      }),
      UserFollow.exists({
        follower: profileUserId,
        following: currentUserId
      })
    ]);

    res.status(200).json({
      message: "Profile fetched successfully",
      data: {
        ...user,
        isFollowing: Boolean(isFollowing),
        followsYou: Boolean(followsYou),
        isOwnProfile: false
      }
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch profile",
      error: error.message
    });
  }
};


exports.toggleFavorite = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;
  console.log("userId",userId);
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(itemId).select("seller isDeleted isActive");

    if (!item || item.isDeleted || !item.isActive) {
      return res.status(404).json({ message: "Item not available" });
    }

    if (item.seller.toString() === userId.toString()) {
      return res.status(403).json({
        message: "You cannot favorite your own item"
      });
    }

    const existing = await ItemFavorite.findOne({
      user: userId,
      item: itemId
    });

    if (existing) {
      await ItemFavorite.deleteOne({ _id: existing._id });

      await Item.findByIdAndUpdate(itemId, {
        $inc: { favoritesCount: -1 }
      });

      return res.status(200).json({
        message: "Item removed from favorites",
        status: "unfavorited"
      });
    } else {
      await ItemFavorite.create({
        user: userId,
        item: itemId
      });

      await Item.findByIdAndUpdate(itemId, {
        $inc: { favoritesCount: 1 }
      });

      return res.status(200).json({
        message: "Item added to favorites",
        status: "favorited"
      });
    }

  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({
        message: "Item already favorited",
        status: "favorited"
      });
    }

    res.status(500).json({
      message: "Failed to update favorite",
      error: error.message
    });
  }
};


exports.getMyFavoriteItems = async (req, res) => {
  try {
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [favorites, total] = await Promise.all([
      ItemFavorite.find({ user: userId })
        .populate({
          path: "item",
          match: {
            isDeleted: false,
            isActive: true,
            // isPublished: true
          },
          select:
            "title price media likesCount commentsCount favoritesCount"
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      ItemFavorite.countDocuments({ user: userId })
    ]);

    const data = favorites
      .filter(f => f.item)
      .map(f => f.item);

    res.status(200).json({
      message: "Favorite items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch favorite items",
      error: error.message
    });
  }
};


exports.getItemByPublicToken = async (req, res) => {
    try {
        const item = await Item.findOne({
            publicToken: req.params.token,
            isActive: true
        })
            .populate("seller", "firstName lastName")
            .populate("category", "title");

        if (!item) {
            return res.status(404).json({
                message: "Item not found or inactive"
            });
        }

        res.status(200).json({
            data: item
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch item",
            error: error.message
        });
    }
};
