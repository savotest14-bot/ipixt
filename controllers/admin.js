const mongoose = require("mongoose");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendMail } = require("../functions/mailer");
const User = require("../models/users");
const fs = require("fs");
const path = require("path");
const {Item} = require("../models/item");
const moment = require("moment");
const { generateOTP, hashOTP, verifyHashOTP } = require("../functions/commons");

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
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const user = await Admin.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const otp = generateOTP();
    const hashedOTP = await hashOTP(otp);
    const otpExpiry = moment().add(10, "minutes").toDate();

    user.otp = hashedOTP;
    user.otpExpires = otpExpiry;
    await user.save();

    const phoneNumber = user.phone;

    const mailVariable = {
      "%otp%": otp,
      "%email%": email || "",
      "%phone%": phoneNumber || ""
    };

    if (email) {
      await sendMail("send-otp", mailVariable, email);
    }

    return res.status(200).json({
      adminId: user._id,
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

exports.verifyResetOtp = async (req, res) => {
  try {
    const { adminId, otp } = req.body;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        message: "Invalid admin id",
      });
    }
    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    if (!admin.otp || admin.otpExpires < Date.now()) {
      return res.status(400).json({
        message: "OTP expired",
      });
    }

    const isOtpValid = await verifyHashOTP(otp, admin.otp);
    if (!isOtpValid) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // Mark OTP as verified
    admin.otpVerified = true;
    await admin.save();

    return res.status(200).json({
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("verify-otp-error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { adminId, newPassword } = req.body;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        message: "Invalid admin id",
      });
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    if (!admin.otpVerified) {
      return res.status(403).json({
        message: "OTP verification required",
      });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    admin.otp = undefined;
    admin.otpExpires = undefined;
    admin.otpVerified = false;
    admin.tokens = [];

    await admin.save();

    return res.status(200).json({
      message: "Password set successfully. Please login again.",
    });
  } catch (error) {
    console.error("set-password-error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};
  


exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Old password, new password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from old password",
      });
    }

    const admin = await Admin.findById(req.user._id).select("+password");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Old password is incorrect",
      });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    admin.tokens = [];

    await admin.save();

    return res.status(200).json({
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    console.error("change-password-error:", error);
    return res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};


exports.getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user._id;
  
    const admin = await Admin.findOne({
      _id: adminId,
      isDeleted: false
    }).select("-password -tokens -adminKey -otp -otpExpires -otpVerified");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    res.status(200).json({
      message: "Admin profile fetched successfully",
      data: admin
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch admin profile",
      error: error.message
    });
  }
};


exports.updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user._id;

    const { email, firstName, phone, facebookLink, instagramLink, twitterLink, linkedinLink, bio } = req.body;

    const updateData = {};

    if (email) updateData.email = email.toLowerCase();
    if (firstName) updateData.firstName = firstName;
    if (phone) updateData.phone = phone;
    if(facebookLink) updateData.facebookLink = facebookLink;
    if(instagramLink) updateData.instagramLink = instagramLink;
    if(twitterLink) updateData.twitterLink = twitterLink;
    if(linkedinLink) updateData.linkedinLink = linkedinLink;
    if(bio) updateData.bio = bio;

    if (req.file) {
      updateData.profilePic = req.file.filename;
   
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided to update"
      });
    }

    const admin = await Admin.findOneAndUpdate(
      { _id: adminId, isDeleted: false },
      { $set: updateData },
      { new: true }
    ).select("firstName lastName email phone profilePic");

    if (!admin) {
      return res.status(404).json({
        message: "Admin not found"
      });
    }

    res.status(200).json({
      message: "Admin profile updated successfully",
      data: admin
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    res.status(500).json({
      message: "Failed to update admin profile",
      error: error.message
    });
  }
};



exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      isDeleted,
      status,
      search
    } = req.query;

    const query = {};

    if (isDeleted !== undefined) {
      query.isDeleted = isDeleted === "true";
    } else {
      query.isDeleted = false;
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      const normalizedStatus = status.trim().toLowerCase();

      if (!["active", "inactive"].includes(normalizedStatus)) {
        return res.status(400).json({
          message: "Invalid status filter"
        });
      }

      query.status = normalizedStatus;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } }
      ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -tokens -otp")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      User.countDocuments(query)
    ]);

    return res.status(200).json({
      message: "Users fetched successfully",
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: users
    });
  } catch (error) {
    console.error("getAllUsers-error:", error);
    return res.status(500).json({
      message: "Failed to fetch users",
      error: error.message
    });
  }
};



exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid user id"
      });
    }

    const user = await User.findById(userId)
      .select("-password -tokens")
      .populate("categories", "title")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "User fetched successfully",
      data: user
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch user",
      error: error.message
    });
  }
};


exports.toggleUserDeleteStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid user id"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    user.isDeleted = !user.isDeleted;
    await user.save();

    res.status(200).json({
      message: `User ${user.isDeleted ? "deleted" : "restored"} successfully`,
      data: {
        userId: user._id,
        isDeleted: user.isDeleted
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user",
      error: error.message
    });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Invalid user id"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    user.status = user.status === "active" ? "inactive" : "active";
    await user.save();

    res.status(200).json({
      message: `User ${user.status === "active" ? "activated" : "deactivated"} successfully`,
      data: {
        userId: user._id,
        status: user.status
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user status",
      error: error.message
    });
  }
};


exports.adminUpdateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const body = req.body || {};
    const updateData = {};

    [
      "firstName",
      "lastName",
      "country",
      "currency",
      "businessName",
      "businessId",
      "isKycCompleted",
      "status",
      "role",
      "isDeleted"
    ].forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });

    if (body.email) {
      const exists = await User.findOne({
        _id: { $ne: userId },
        email: body.email.toLowerCase()
      });
      if (exists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = body.email.toLowerCase();
    }

    if (body.phoneNumber || body.countryCode) {
      if (!body.phoneNumber || !body.countryCode) {
        return res.status(400).json({
          message: "Phone number and country code required"
        });
      }

      const exists = await User.findOne({
        _id: { $ne: userId },
        phoneNumber: body.phoneNumber,
        countryCode: body.countryCode
      });

      if (exists) {
        return res.status(400).json({
          message: "Phone number already exists"
        });
      }

      updateData.phoneNumber = body.phoneNumber;
      updateData.countryCode = body.countryCode;
    }

    if (body.categories) {
      updateData.categories = body.categories
        .split(",")
        .map(id => id.trim());
    }

    if (req.file) {
      if (user.profilePic) {
        const oldPath = path.join(
          process.cwd(),
          "uploads",
          "profilePics",
          user.profilePic
        );
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.profilePic = req.file.filename;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password -tokens");

    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to update user",
      error: error.message
    });
  }
};


exports.getItemsBySellerId = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const {
      page = 1,
      limit = 10,
      isActive,
      format,
      search
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({
        message: "Invalid seller id"
      });
    }

    const query = {
      seller: sellerId
    };

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (format) {
      if (!["physical", "digital", "service"].includes(format)) {
        return res.status(400).json({
          message: "Invalid format"
        });
      }
      query.format = format;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Item.find(query)
        .populate("category", "title")
        .populate("seller", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      Item.countDocuments(query)
    ]);

    res.status(200).json({
      message: "Items fetched successfully",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      },
      data: items
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch items",
      error: error.message
    });
  }
};

exports.getAllItemsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      seller,
      format,
      sort = "latest",
      isPublish,
      isActive
    } = req.query;

    const query = {
      isDeleted: false
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    if (category) query.category = category;
    if (seller) query.seller = seller;
    if (format) query.format = format;

    if (isPublish !== undefined) {
      query.isPublish = isPublish === "true";
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    let sortQuery = { createdAt: -1 };
    if (sort === "price_asc") sortQuery = { price: 1 };
    if (sort === "price_desc") sortQuery = { price: -1 };

    const skip = (page - 1) * limit;

    const [items, totalItems] = await Promise.all([
      Item.find(query)
        .populate("seller", "firstName lastName email")
        .populate("category", "title")
        .sort(sortQuery)
        .skip(skip)
        .limit(Number(limit)),

      Item.countDocuments(query)
    ]);

    res.status(200).json({
      message: "Items fetched successfully",
      data: items,
      pagination: {
        totalItems,
        currentPage: Number(page),
        totalPages: Math.ceil(totalItems / limit),
        limit: Number(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch items",
      error: error.message
    });
  }
};

exports.getItemByIdForAdmin = async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        message: "Invalid item id"
      });
    }

    const item = await Item.findOne({
      _id: itemId,
      isDeleted: false
    })
      .populate("seller", "firstName lastName email")
      .populate("category", "title");

    if (!item) {
      return res.status(404).json({
        message: "Item not found"
      });
    }

    res.status(200).json({
      message: "Item fetched successfully",
      data: item
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch item",
      error: error.message
    });
  }
};