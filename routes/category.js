const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");

const {
    getAllCategories,
    createCategory,
   getCategoryById,
   updateCategoryById,
    softDeleteCategory
} = require("../controllers/category");
const { upload } = require("../middlewares/upload");

router.get("/getAllCategories", authenticate, getAllCategories);
router.post("/create", authenticate, upload.single("image"), createCategory);
router.get("/getCategory/:categoryId", authenticate,getCategoryById);
router.put("/update/:categoryId", authenticate, upload.single("image"), updateCategoryById);

router.delete("/soft-delete/:categoryId", authenticate, softDeleteCategory);


module.exports = router;
