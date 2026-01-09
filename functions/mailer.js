const nodemailer = require("nodemailer");
const MailTemplate = require("../models/templates");

const sendMail = async (templateName, mailVariable, email) => {
  try {
    const template = await MailTemplate.findOne({
      templateEvent: templateName,
      isDeleted: false,
      active: true,
    }).lean(true);

    let subject = template.subject;
    let html = template.htmlBody;
    let text = template.textBody;

    // Replace variables in template
    for (const key in mailVariable) {
      if (Object.prototype.hasOwnProperty.call(mailVariable, key)) {
        const value = mailVariable[key];
        if (typeof value === "string") {
          subject = subject.split(key).join(value);
          html = html.split(key).join(value);
          text = text.split(key).join(value);
        }
      }
    }
   
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: '"No Reply" <shikhajatav23march@gmail.com>',
      to: email,
      subject,
      text,
      html,
    };

    // Send mail
    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) return reject(error);
        resolve();
      });
    });

    return { type: "success", message: "Mail successfully sent" };
  } catch (error) {
    throw new Error(error.message || "Failed to send mail");
  }
};

module.exports = { sendMail };