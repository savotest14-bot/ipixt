const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const template = require("../models/templates");
const Admin = require("../models/admin");

const connectDB = async () => {
  try {
    const connect = await mongoose.connect(process.env.CONNECTION_STRING);
    console.log(
      "Database connected: ",
      connect.connection.host,
      connect.connection.name
    );

    const checkAdmin = await Admin.countDocuments();

    if (checkAdmin === 0) {
      const hashedPassword = await bcrypt.hash("Admin@123", 10); // hash password with saltRounds=10

      await Admin.create({
        adminKey: process.env.ADMIN_KEY,
        email: "shikhajatav23march@gmail.com",
        phone: process.env.ADMIN_TWILO_NUMBER,
        password: hashedPassword,
      });

      console.log("✅ Default admin created with hashed password");
    }

    const templates = await template.countDocuments({});

    if (!templates) {
      await template.insertMany([
        {
          templateEvent: "otp-verify",
          subject: "NZL OTP Verification",
          mailVariables: "%otp% %fullName%",
          htmlBody: `
  <body style="margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background-color: #f4f4f4;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
      <tr>
        <td align="center" style="padding: 20px;">
          <table width="600" border="0" cellspacing="0" cellpadding="0"
            style="border-collapse: collapse; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            
            <tr>
              <td
                style="background-color: #3760FA; padding: 30px; text-align: center; color: white; font-size: 28px; font-weight: 600;">
                NZL Account Verification
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td
                style="padding: 40px 30px; text-align: left; font-size: 16px; line-height: 1.6; color: #333333;">
                <h2 style="margin-top: 0; color: #3760FA;">Hello, %fullName%!</h2>

                <p>Please use the following verification code to complete your action. The code is valid for
                  <strong>10 minutes</strong>.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding: 10px 30px; text-align: center;">
                <div
                  style="background-color: #eaf6f5; padding: 20px; font-size: 32px; font-weight: 700; letter-spacing: 5px; text-align: center; border-radius: 8px; color: #3760FA;">
                  %otp%
                </div>
              </td>
            </tr>

            <tr>
              <td
                style="padding: 30px 30px 40px 30px; text-align: left; font-size: 16px; line-height: 1.6; color: #333333;">
                <p style="margin-bottom: 0;">For your security, please do not share this code with anyone.
                  If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>

            <tr>
              <td
                style="background-color: #263238; padding: 20px; text-align: center; color: #bbbbbb; font-size: 14px;">
                Copyright © ${new Date().getFullYear()} | NZL. All rights reserved.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  `,
          textBody: `Hello %fullName%, your verification code is %otp%. Please use it within 10 minutes.`,
        },
        {
          templateEvent: "send-otp",
          subject: "Your Verification Code – %otp%",
          mailVariables: "%otp% %email% %phone%",
          htmlBody: `
  <body style="margin:0;padding:0;font-family:'Poppins',Arial,sans-serif;background:#f4f4f4;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#f4f4f4;">
      <tr>
        <td align="center" style="padding:20px;">
          
          <table width="600" border="0" cellspacing="0" cellpadding="0"
           style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background:#3760FA;padding:30px;text-align:center;color:#fff;font-size:28px;font-weight:600;">
                Account Verification
              </td>
            </tr>

            <!-- Message -->
            <tr>
              <td style="padding:40px 30px;font-size:16px;color:#333;line-height:1.6;">
                <p>Please use the verification code below.<br>
                This code will expire in <strong>10 minutes</strong>.</p>
              </td>
            </tr>

            <!-- OTP Box -->
            <tr>
              <td style="padding:10px 30px;text-align:center;">
                <div style="
                  background:#eaf6f5;
                  padding:20px;
                  font-size:32px;
                  font-weight:700;
                  letter-spacing:5px;
                  border-radius:8px;
                  color:#3760FA;
                ">
                  %otp%
                </div>
              </td>
            </tr>

            <!-- Security Note -->
            <tr>
              <td style="padding:30px 30px 40px;font-size:16px;color:#333;line-height:1.6;">
                <p style="margin:0;">
                  Do not share this code with anyone.<br>
                  If you did not request this OTP, ignore this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#263238;padding:20px;text-align:center;color:#bbb;font-size:14px;">
                © ${new Date().getFullYear()} | IPXIT. All rights reserved.
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
  `,
          textBody: `Your OTP is %otp%. It is valid for 10 minutes. Do not share this code with anyone.`,
        },

      ]);
      console.log("✅ Default email template added");
    }
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;