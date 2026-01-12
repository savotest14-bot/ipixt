const mongoose = require("mongoose");
const Admin = require("../models/admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send({ message: "Email and password are required" });
        }

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(404).send({ message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(400).send({ message: "Incorrect password" });
        }

        const token = jwt.sign(
              { userId: admin._id },
              process.env.JWT_SECRET,
              { expiresIn: "7d" }
            );
       await Admin.updateOne({ _id: admin._id }, { $unset: { otp: "", otpExpires: "" }, $push: { tokens: token } });
        return res.status(200).send({ message: "Login successful", token });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ message: "Server error" });
    }
}

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
       await Admin.updateOne({ _id: decoded.userId }, { $pull: { tokens: token } });
        return res.status(200).send({ message: "Logged out successfully" });

      } catch (error) {
        return res.status(500).send({ message: error.message });
      }
    });

  } catch (error) {
    return res.status(500).send({ message: "Internal server error" });
  }
};


