const express = require("express");
const router = express.Router();
const { adminLogin, logout } = require("../controllers/admin");
const { userLogin } = require("../validations/validator");
const validate = require("../middlewares/validate");

router.post("/login", validate(userLogin), adminLogin);
router.post("/logout", logout);

module.exports = router;