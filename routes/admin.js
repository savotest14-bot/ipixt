const express = require("express");
const router = express.Router();
const { adminLogin, logout } = require("../controllers/admin");
const { userLogin } = require("../validations/validator");
const validate = require("../middlewares/validate");

router.post("/signin", validate(userLogin), adminLogin);
router.post("/signout", logout);

module.exports = router;