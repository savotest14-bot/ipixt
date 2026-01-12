const Joi = require("joi");

const userValidation = Joi.object({
  email: Joi.string().email().messages({
    "string.email": "Please enter a valid email",
  }),

    phoneNumber: Joi.string()
        .pattern(/^\d+$/)
        .min(8)
        .max(15)
        .messages({
            "string.empty": "Please enter the phone number",
            "string.pattern.base": "Phone number must contain only digits",
            "string.min": "Phone number must be at least 8 digits",
            "string.max": "Phone number must be at most 15 digits",
        }),

    countryCode: Joi.string()
        .pattern(/^\+\d{1,4}$/)
        .messages({
            "string.pattern.base":
                "Country code must be in format +91, +1, etc.",
        }),
})
    .or("email", "phoneNumber")

    .with("phoneNumber", "countryCode")

    .without("countryCode", ["email"])

    .messages({
        "object.missing": "Either email or phone number is required",
        "object.with": "Country code is required when phone number is provided",
    });


const verifyOTPValidation = Joi.object({
  otp: Joi.string().required().messages({
    "string.empty": "Please enter the otp",
  }),
});

const userLogin = Joi.object({
  email: Joi.string().email().messages({
    "string.email": "Please enter a valid email",
  }),

  phoneNumber: Joi.string().pattern(/^\d+$/).min(8).max(15).messages({
    "string.empty": "Please enter the phone number",
    "string.pattern.base": "Phone number must contain only digits",
    "string.min": "Phone number must be at least 8 digits",
    "string.max": "Phone number must be at most 15 digits",
  }),

    password: Joi.string()
        .min(8)
        .max(30)
        .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).+$/)
        .required()
        .messages({
            "string.empty": "Please enter a password",
            "string.min": "Password must be at least 8 characters",
            "string.max": "Password must be at most 30 characters",
            "string.pattern.base": "Password must include uppercase, lowercase, number & special character",
        }),

    countryCode: Joi.string()
        .pattern(/^\+\d{1,4}$/)
        .messages({
            "string.pattern.base":
                "Country code must be in format +91, +1, etc.",
        }),
})
    .or("email", "phoneNumber")
    .with("phoneNumber", "countryCode")

    .without("countryCode", ["email"])
    .messages({
        "object.missing": "please provide email or phone number to login",
        "object.with": "Country code is required when phone number is provided",
    });


const setPasswordValidation = Joi.object({
  id: Joi.string().required().messages({
    "string.empty": "User ID is required",
  }),

  newPassword: Joi.string()
    .min(8)
    .max(30)
    .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/)
    .required()
    .messages({
      "string.empty": "Please enter a password",
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base":
        "Password must include uppercase, lowercase, and a number",
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Confirm password is required",
    }),
});

const forgotPasswordValidation = Joi.object({
  email: Joi.string().email().messages({
    "string.email": "Please enter a valid email",
  }),

  phone: Joi.string()
    .pattern(/^\d{10,15}$/)
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
    }),
}).xor("email", "phone");


const personalKycSchema = Joi.object({
    firstName: Joi.string().trim().required(),
    lastName: Joi.string().trim().required(),
    businessName: Joi.string().trim(),
    businessId: Joi.string().trim(),
    dob: Joi.string()
  .pattern(/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/)
  .required()
  .messages({
    "string.pattern.base": "DOB must be in DD/MM/YYYY format"
  }).required(),
    currency: Joi.string().required(),

    country: Joi.string().required(),

    kyc: Joi.object().required()
});


module.exports = { userValidation, verifyOTPValidation, userLogin, setPasswordValidation, resetPasswordValidation, personalKycSchema };

