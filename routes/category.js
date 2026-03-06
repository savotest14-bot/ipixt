const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");

const {
    getAllCategories,
    createCategory,
   getCategoryById,
   updateCategoryById,
    softDeleteCategory,
    addSubCategory,
    updateSubCategory,
    deleteSubCategory,
    getSubCategoriesByCategory,
    getSubCategoryById
} = require("../controllers/category");
const { upload } = require("../middlewares/upload");
const { checkPermission } = require("../middlewares/checkPermission");

router.get("/getAllCategories", authenticate, getAllCategories);
router.post("/create", authenticate, upload.single("image"), createCategory);
router.get("/getCategory/:categoryId", authenticate,getCategoryById);
router.put("/update/:categoryId", authenticate, upload.single("image"), updateCategoryById);

router.delete("/soft-delete/:categoryId", authenticate, softDeleteCategory);

router.post("/subcategory", authenticate, checkPermission('items_edit'), upload.single("subImage"), addSubCategory);

router.put("/subcategory/:id", authenticate, upload.single("subImage"), updateSubCategory);

router.delete("/subcategory/:id", authenticate, deleteSubCategory);

router.get("/getSubCategoryByCategoryId/:categoryId", authenticate, getSubCategoriesByCategory);

router.get("/subcategory/:id", authenticate, getSubCategoryById);


module.exports = router;
